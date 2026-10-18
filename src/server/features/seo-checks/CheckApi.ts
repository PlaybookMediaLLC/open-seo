import { env } from "cloudflare:workers";
import { and, asc, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import {
  ciCheckFindings,
  ciCheckRuns,
  ciCheckUrls,
  ciPreviewHosts,
} from "@/db/schema";
import { customerHasPaidPlan } from "@/server/billing/subscription";
import { normalizeAndValidateStartUrl } from "@/server/lib/audit/url-policy";
import { isHostedServerAuthMode } from "@/server/lib/runtime-env";
import type { CreateCheckInput } from "@/types/schemas/seoChecks";
import type { CiTokenContext } from "./ciTokens";
import { recordAudit } from "@/server/features/activity/auditLog";
import { isAllowedPreviewHost } from "./previewHosts";
import { startCheckWorkflow } from "./seoCheckRun";

// RFC-0010 5.10: the API that the GitHub Action calls with a CI token.
const FREE_RUNS_PER_MONTH = 30;
const PAID_RUNS_PER_MONTH = 1000;
const BILLING_URL = "https://relay.playbookmedia.io/billing";

type ApiResult = { status: number; body: Record<string, unknown> };
const fail = (status: number, error: string, message: string): ApiResult => ({
  status,
  body: { error, message },
});

async function rateLimited(tokenId: string) {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- declared as a rate limiter in deploy/alchemy/relay-env.ts; absent outside hosted prod
  const limiter = (env as { CI_CHECK_RATE_LIMIT?: RateLimit })
    .CI_CHECK_RATE_LIMIT;
  if (!limiter) return false;
  return !(await limiter.limit({ key: tokenId })).success;
}

async function overQuota(
  token: { projectId: string; organizationId: string },
  now: Date,
) {
  const monthStart = `${now.toISOString().slice(0, 7)}-01T00:00:00.000Z`;
  const [row] = await db
    .select({ total: count() })
    .from(ciCheckRuns)
    .where(
      and(
        eq(ciCheckRuns.projectId, token.projectId),
        gte(ciCheckRuns.createdAt, monthStart),
      ),
    );
  const quota =
    (await isHostedServerAuthMode()) &&
    !(await customerHasPaidPlan(token.organizationId))
      ? FREE_RUNS_PER_MONTH
      : PAID_RUNS_PER_MONTH;
  return Number(row?.total ?? 0) >= quota;
}

/** The GitHub Action's request: rate limited per token, then queued. */
export async function createCheck(
  token: CiTokenContext,
  input: CreateCheckInput,
  now = new Date(),
): Promise<ApiResult> {
  if (await rateLimited(token.tokenId))
    return {
      ...fail(429, "rate_limited", "Too many checks. Try again in a minute."),
      body: { error: "rate_limited", retryAfterSeconds: 60 },
    };
  return queueCheck(
    token,
    input,
    { source: "action", installationId: null },
    now,
  );
}

type CheckScope = Omit<CiTokenContext, "tokenId"> & { tokenId: string | null };

/** Validates and queues a run; the same commit and preview reuse one run. */
export async function queueCheck(
  token: CheckScope,
  input: CreateCheckInput,
  origin: { source: "action" | "app"; installationId: number | null },
  now = new Date(),
): Promise<ApiResult> {
  if (!token.domain)
    return fail(400, "no_domain", "Set the project's website in Relay first.");
  const preview = new URL(input.previewUrl);
  const ownerHosts = await db
    .select({ host: ciPreviewHosts.host })
    .from(ciPreviewHosts)
    .where(eq(ciPreviewHosts.projectId, token.projectId));
  if (
    preview.protocol !== "https:" ||
    !isAllowedPreviewHost(
      preview.hostname,
      token.domain,
      ownerHosts.map((row) => row.host),
    )
  )
    return fail(
      400,
      "preview_host_not_allowed",
      `Relay does not check ${preview.hostname}. Add it in Project settings > SEO checks.`,
    );
  try {
    await normalizeAndValidateStartUrl(preview.origin);
  } catch {
    return fail(
      400,
      "preview_host_not_allowed",
      "That preview host is blocked.",
    );
  }
  const scope = and(
    eq(ciCheckRuns.projectId, token.projectId),
    eq(ciCheckRuns.headSha, input.headSha),
    eq(ciCheckRuns.previewOrigin, preview.origin),
  );
  const [existing] = await db
    .select({ id: ciCheckRuns.id, status: ciCheckRuns.status })
    .from(ciCheckRuns)
    .where(scope);
  if (existing) return { status: 200, body: existing };
  if (await overQuota(token, now))
    return fail(
      429,
      "quota_reached",
      `This project used its SEO checks for the month. Upgrade at ${BILLING_URL}.`,
    );
  const id = crypto.randomUUID();
  await db
    .insert(ciCheckRuns)
    .values({
      id,
      projectId: token.projectId,
      tokenId: token.tokenId,
      repository: input.repository,
      pullRequest: input.pullRequest ?? null,
      headSha: input.headSha,
      previewOrigin: preview.origin,
      baseOrigin: `https://${token.domain}`,
      changedFiles: input.changedFiles.join("\n"),
      status: "queued",
      source: origin.source,
      installationId: origin.installationId,
      overrideUsed: input.override,
      createdAt: now.toISOString(),
    })
    .onConflictDoNothing();
  const [run] = await db
    .select({ id: ciCheckRuns.id, status: ciCheckRuns.status })
    .from(ciCheckRuns)
    .where(scope);
  if (run?.id === id) {
    // RFC-0010 5.8: the override label passes blocking findings; record who.
    if (input.override)
      await recordAudit({
        organizationId: token.organizationId,
        projectId: token.projectId,
        actor: { userId: token.tokenId ?? "github-app", scheduled: true },
        action: "seo_check.overridden",
        targetType: "pull_request",
        targetId: `${input.repository}#${input.pullRequest ?? "?"}`,
        summary: `The relay-seo-override label passed ${input.repository}#${input.pullRequest ?? "?"} at ${input.headSha.slice(0, 7)}`,
      });
    await startCheckWorkflow(id);
  }
  return { status: 202, body: run ?? { id, status: "queued" } };
}

/** A run of the token's own project, with its findings and traffic. */
export async function getCheck(
  token: CiTokenContext,
  runId: string,
): Promise<ApiResult> {
  const [run] = await db
    .select()
    .from(ciCheckRuns)
    .where(
      and(
        eq(ciCheckRuns.projectId, token.projectId),
        eq(ciCheckRuns.id, runId),
      ),
    );
  if (!run) return fail(404, "not_found", "No such check.");
  const [findings, urls] = await Promise.all([
    db
      .select()
      .from(ciCheckFindings)
      .where(eq(ciCheckFindings.runId, run.id))
      .orderBy(asc(ciCheckFindings.path)),
    db.select().from(ciCheckUrls).where(eq(ciCheckUrls.runId, run.id)),
  ]);
  return {
    status: 200,
    body: {
      id: run.id,
      status: run.status,
      blocking: run.blockingCount,
      warnings: run.warningCount,
      urls: run.urlCount,
      overrideUsed: run.overrideUsed,
      error: run.error,
      findings: findings.map((finding) => {
        const page = urls.find((url) => url.path === finding.path);
        return {
          path: finding.path,
          rule: finding.rule,
          severity: finding.severity,
          before: finding.beforeValue,
          after: finding.afterValue,
          message: finding.message,
          clicks28d: page?.clicks28d ?? null,
          impressions28d: page?.impressions28d ?? null,
        };
      }),
    },
  };
}
