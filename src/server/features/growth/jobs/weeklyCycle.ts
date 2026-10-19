import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import {
  weekOf,
  workSettingsFor,
  writeCycle,
} from "@/server/features/work/workData";
import { captureServerEvent } from "@/server/lib/posthog";
import type { JobContext } from "../growthJobs";
import { GrowthJobRepository } from "../repositories/GrowthJobRepository";
import { opportunityRefreshJob } from "./opportunityJobs";

// RFC-0018 5.2: close the last week, refresh old detection, write this
// week's cycle once, and tell the project.
const DETECTION_DAYS = 7;

export async function weeklyCycleJob(context: JobContext) {
  const { projectId, now } = context;
  const settings = await workSettingsFor(projectId);
  const week = weekOf(now, settings);
  const latest = await OpportunityRepository.latestRun(
    projectId,
    undefined,
    "search_console",
  );
  if (
    !latest ||
    now.getTime() - Date.parse(latest.startedAt) > DETECTION_DAYS * 86_400_000
  )
    // Detection keeps its own cooldown; a failure leaves the older data.
    await opportunityRefreshJob(context).catch((error: unknown) =>
      context.log(
        "warn",
        `Detection refresh failed: ${error instanceof Error ? error.message : "unknown"}`,
      ),
    );
  const cycle = await writeCycle(projectId, week, now, settings);
  if (!cycle)
    return { summary: `The cycle for the week of ${week.startDate} exists.` };
  const count = (section: string) =>
    cycle.entries.filter((entry) => entry.section === section).length;
  const [completed, measuring, next, waiting] = [
    count("completed"),
    count("measuring"),
    count("next"),
    count("waiting"),
  ];
  const summary = `${completed} completed, ${measuring} measuring, ${next} next, ${waiting} waiting on you.`;
  // RFC-0018 5.10: the email digest carries this body, so it lists items.
  const list = (section: string, label: string) => {
    const titles = cycle.entries
      .filter((entry) => entry.section === section)
      .map((entry) => entry.title);
    return titles.length
      ? `${label}: ${titles.slice(0, 3).join("; ")}${titles.length > 3 ? `, and ${titles.length - 3} more` : ""}.`
      : "";
  };
  await GrowthJobRepository.notify({
    organizationId: context.organizationId,
    projectId,
    kind: "weekly_cycle",
    title: `This week: ${next ? `${next} next` : "nothing worth changing"}`,
    body: [
      summary,
      list("waiting", "Waiting on you"),
      list("next", "Next"),
      list("completed", "Completed"),
      list("measuring", "Measuring"),
      cycle.emptyReasons,
    ]
      .filter(Boolean)
      .join(" "),
    linkPath: `/p/${projectId}/work`,
    dedupeKey: week.startDate,
  });
  // RFC-0018 5.11: the weekly counts and why Next was short.
  await captureServerEvent({
    distinctId: context.actor.userId,
    event: "work_cycle:generated",
    organizationId: context.organizationId,
    properties: {
      project_id: projectId,
      week_start: week.startDate,
      completed,
      measuring,
      next,
      waiting,
      empty_next: next === 0,
      reasons: cycle.reasonCodes,
    },
  });
  return { summary: `Week of ${week.startDate}: ${summary}` };
}
