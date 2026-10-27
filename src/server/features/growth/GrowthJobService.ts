import { hasOrgPermission } from "@/lib/org-permissions";
import { AuthRepository } from "@/server/auth/repositories/AuthRepository";
import { customerHasPaidPlan } from "@/server/billing/subscription";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { AppError } from "@/server/lib/errors";
import { isHostedServerAuthMode } from "@/server/lib/runtime-env";
import type { GrowthRunInput } from "@/types/schemas/growthJobs";
import { auditStarter } from "./jobs/auditFollowup";
import { GROWTH_JOBS } from "./growthJobs";
import {
  GrowthJobRepository as repo,
  type LogLine,
} from "./repositories/GrowthJobRepository";
import { deleteAuditEventsBefore } from "@/server/features/activity/ActivityService";
import { deleteCheckRunsBefore } from "@/server/features/seo-checks/SeoCheckSettingsService";

// RFC-0008 5.1: the Worker side of scheduled growth jobs. Trigger.dev asks
// what is due, then asks the Worker to run each item; the Worker does all
// data work with its bindings and keeps the history.
const DUE_LIMIT = 200;
const RETENTION_DAYS = 180;
const AUDIT_RETENTION_DAYS = 365;
const SEO_CHECK_RETENTION_DAYS = 90;
const DAY_MS = 86_400_000;
type Schedule = NonNullable<Awaited<ReturnType<typeof repo.getSchedule>>>;
type RunResult = {
  status: 200 | 422 | 503;
  body: { status: "succeeded" | "skipped" | "failed"; summary: string };
};

/** The next slot after the observed one; a late run never queues a backlog. */
function nextRunAt(
  schedule: Pick<Schedule, "interval" | "hourUtc" | "nextRunAt">,
  now: Date,
) {
  const step = (schedule.interval === "weekly" ? 7 : 1) * DAY_MS;
  const slot = new Date(schedule.nextRunAt);
  slot.setUTCHours(schedule.hourUtc, 0, 0, 0);
  // UTC days have no daylight-saving jumps, so steps of whole days are exact.
  let next = slot.getTime() + step;
  while (next <= now.getTime()) next += step;
  return new Date(next).toISOString();
}

/** Due work, oldest first. It changes nothing, so a dispatch can repeat. */
async function due(now: Date) {
  const schedules = await repo.dueSchedules(now.toISOString(), DUE_LIMIT);
  const queued = await repo.queuedRuns(DUE_LIMIT - schedules.length);
  return {
    items: [
      ...schedules.map((schedule) => ({
        kind: schedule.kind,
        projectId: schedule.projectId,
        scheduleId: schedule.id,
        windowKey: schedule.nextRunAt.slice(0, 10),
      })),
      ...queued.map((item) => ({
        kind: item.kind,
        projectId: item.projectId,
        scheduleId: item.scheduleId,
        windowKey: item.windowKey,
      })),
    ],
  };
}

/** Never store a provider body or token; only our own messages pass. */
function safeError(error: unknown) {
  return error instanceof AppError && error.message
    ? error.message
    : "The job failed.";
}

async function run(
  input: GrowthRunInput,
  now = new Date(),
): Promise<RunResult> {
  const { projectId, kind, windowKey } = input;
  const project = await ProjectRepository.getProjectById(projectId);
  if (!project || project.archivedAt)
    return {
      status: 422,
      body: { status: "skipped", summary: "The project no longer exists." },
    };
  if (await repo.succeededRun(projectId, kind, windowKey))
    return {
      status: 200,
      body: { status: "succeeded", summary: "Already done for this window." },
    };
  const schedule = input.scheduleId
    ? await repo.getSchedule(projectId, input.scheduleId)
    : null;
  if (input.scheduleId && !schedule)
    return {
      status: 422,
      body: { status: "skipped", summary: "The schedule no longer exists." },
    };
  const runId = crypto.randomUUID();
  // A cron tick runs its jobs one after another, so `now` (the tick) is not
  // when this job started; the history must show its real start and duration.
  const startedAt = new Date().toISOString();
  const started = await repo.startRun({
    id: runId,
    projectId,
    scheduleId: schedule?.id ?? null,
    kind,
    windowKey,
    attempt: input.attempt,
    triggerRunId: input.triggerRunId ?? null,
    status: "running",
    startedAt,
    createdAt: startedAt,
  });
  if (!started)
    return {
      status: 200,
      body: { status: "skipped", summary: "This attempt already ran." },
    };
  const logs: LogLine[] = [];
  const finish = async (
    status: "succeeded" | "failed" | "skipped",
    text: string,
  ) => {
    await repo.finishRun({
      projectId,
      runId,
      kind,
      windowKey,
      status,
      logs,
      ...(status === "succeeded"
        ? { summary: text }
        : status === "skipped"
          ? { skipReason: text }
          : { error: text }),
    });
    if (schedule && status !== "failed")
      await repo.advanceSchedule(
        schedule.id,
        schedule.nextRunAt,
        nextRunAt(schedule, now),
      );
  };
  const notifyFailure = (title: string, body: string) =>
    repo.notify({
      organizationId: project.organizationId,
      projectId,
      kind: "job_failed",
      title,
      body,
      linkPath: `/p/${projectId}/settings/automation`,
      dedupeKey: `${kind}:${windowKey}`,
    });
  const skip = async (reason: string): Promise<RunResult> => {
    await finish("skipped", reason);
    return { status: 200, body: { status: "skipped", summary: reason } };
  };

  // RFC-0008 5.7: the job uses a real member's current permissions. An
  // audit follow-up uses the member who started the audit.
  const ownerId =
    schedule?.ownerUserId ??
    (kind === "audit_followup"
      ? await auditStarter(projectId, windowKey)
      : null);
  const membership = ownerId
    ? await AuthRepository.getMembership(ownerId, project.organizationId)
    : null;
  // Any member can start an audit, so its follow-up needs membership only.
  if (
    !ownerId ||
    !membership ||
    (kind !== "audit_followup" &&
      !hasOrgPermission(membership.role, { integration: ["manage"] }))
  ) {
    await notifyFailure(
      "A scheduled job was skipped",
      "The schedule owner no longer has access. A manager can turn the job on again in Automation.",
    );
    return skip("The schedule owner no longer has access.");
  }
  // RFC-0008 5.9: some jobs and intervals need a paid plan.
  const needsPaidPlan =
    kind === "traffic_watch" ||
    (kind === "opportunity_refresh" && schedule?.interval === "daily");
  if (
    needsPaidPlan &&
    (await isHostedServerAuthMode()) &&
    !(await customerHasPaidPlan(project.organizationId, { retryDenied: true }))
  )
    return skip("Your plan does not include this job.");
  const job = GROWTH_JOBS[kind];
  if (!job) return skip("This job is not available yet.");

  try {
    const { summary } = await job({
      projectId,
      windowKey,
      organizationId: project.organizationId,
      actor: {
        organizationId: project.organizationId,
        userId: ownerId,
        role: membership.role,
        scheduled: true,
      },
      now,
      log: (level, message) =>
        logs.push({ at: new Date().toISOString(), level, message }),
    });
    await finish("succeeded", summary);
    return { status: 200, body: { status: "succeeded", summary } };
  } catch (error) {
    const message = safeError(error);
    logs.push({ at: new Date().toISOString(), level: "error", message });
    await finish("failed", message);
    if (input.attempt < input.maxAttempts)
      return { status: 503, body: { status: "failed", summary: message } };
    // The final failure tells the project and moves to the next window.
    await notifyFailure("A scheduled job failed", message);
    if (schedule)
      await repo.advanceSchedule(
        schedule.id,
        schedule.nextRunAt,
        nextRunAt(schedule, now),
      );
    return { status: 422, body: { status: "failed", summary: message } };
  }
}

async function retention(now = new Date()) {
  const deleted = await repo.deleteBefore(
    new Date(now.getTime() - RETENTION_DAYS * DAY_MS).toISOString(),
  );
  // RFC-0009 5.6: audit events stay for one year.
  const auditEvents = await deleteAuditEventsBefore(
    new Date(now.getTime() - AUDIT_RETENTION_DAYS * DAY_MS).toISOString(),
  );
  // RFC-0010 5.9: SEO check runs stay for 90 days.
  const seoCheckRuns = await deleteCheckRunsBefore(
    new Date(now.getTime() - SEO_CHECK_RETENTION_DAYS * DAY_MS).toISOString(),
  );
  return { ...deleted, auditEvents, seoCheckRuns };
}

export const GrowthJobService = { due, run, retention };
