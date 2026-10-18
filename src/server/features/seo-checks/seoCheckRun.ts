import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { ciCheckFindings, ciCheckRuns, ciCheckUrls } from "@/db/schema";
import { linkStatus, fetchSnapshot } from "./pageSnapshot";
import { previewAccess, type CheckPlan } from "./seoCheckPlan";
import { comparePage, compareSite, weigh, type Finding } from "./seoRules";

// RFC-0010 5.2 to 5.8: the steps of one SeoCheckWorkflow run.
const PARALLEL_PER_HOST = 4;

type PlannedUrl = CheckPlan["urls"][number];
export type BatchResult = {
  urls: Array<
    PlannedUrl & { baseStatus: number | null; previewStatus: number | null }
  >;
  findings: Finding[];
  linksChecked: number;
};

async function inPool<T, R>(items: T[], work: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += PARALLEL_PER_HOST)
    results.push(
      ...(await Promise.all(
        items.slice(index, index + PARALLEL_PER_HOST).map(work),
      )),
    );
  return results;
}

/** Fetches a batch of pages on both hosts and compares them. */
export async function checkBatch(
  plan: CheckPlan,
  batch: PlannedUrl[],
  linkBudget: number,
): Promise<BatchResult> {
  const access = await previewAccess(plan.projectId, plan.previewOrigin);
  const pages = await inPool(batch, async (url) => ({
    url,
    base: await fetchSnapshot(`${plan.baseOrigin}${url.path}`, null),
    preview: await fetchSnapshot(`${plan.previewOrigin}${url.path}`, access),
  }));
  const findings: Finding[] = [];
  let linksChecked = 0;
  for (const { url, base, preview } of pages) {
    findings.push(
      ...comparePage(base, preview, {
        path: url.path,
        baseOrigin: plan.baseOrigin,
        previewOrigin: plan.previewOrigin,
        checkRobotsHeader: plan.checkRobotsHeader,
      }),
    );
    const known = new Set(base.page?.internalLinks ?? []);
    const added = (preview.page?.internalLinks ?? []).filter(
      (link) => !known.has(link),
    );
    const checks = added.slice(0, Math.max(0, linkBudget - linksChecked));
    linksChecked += checks.length;
    const statuses = await inPool(checks, (link) =>
      linkStatus(`${plan.previewOrigin}${link}`, access),
    );
    checks.forEach((link, index) => {
      const status = statuses[index];
      if (status && status >= 400)
        findings.push({
          path: url.path,
          rule: "broken-internal-link",
          severity: "warning",
          before: null,
          after: `${link} (${status})`,
          message: "A link that is new on the preview is broken.",
        });
    });
  }
  return {
    urls: pages.map(({ url, base, preview }) => ({
      ...url,
      baseStatus: base.status,
      previewStatus: preview.status,
    })),
    findings,
    linksChecked,
  };
}

/** Adds the site rules, weighs and filters findings, and stores the result. */
export async function finishCheck(plan: CheckPlan, batches: BatchResult[]) {
  const urls = batches.flatMap((batch) => batch.urls);
  const traffic = (path: string) => {
    const url = plan.urls.find((entry) => entry.path === path);
    return url
      ? {
          clicks: url.clicks ?? 0,
          impressions: url.impressions ?? 0,
          role: url.role,
        }
      : undefined;
  };
  const findings = weigh(
    [
      ...compareSite({
        paths: plan.urls.map((url) => url.path),
        baseAllows: (path) =>
          plan.urls.find((url) => url.path === path)?.baseAllowed ?? true,
        previewAllows: (path) =>
          plan.urls.find((url) => url.path === path)?.previewAllowed ?? true,
        baseSitemapCount: plan.baseSitemapCount,
        previewSitemapCount: plan.previewSitemapCount,
      }),
      ...batches.flatMap((batch) => batch.findings),
    ],
    traffic,
    { raiseOnHighTraffic: plan.raiseOnHighTraffic, ignores: plan.ignores },
  );
  const blocking = findings.filter(
    (finding) => finding.severity === "blocking",
  );
  // A retried finish replaces what an earlier attempt stored.
  await runBatch((tx) => [
    tx.delete(ciCheckUrls).where(eq(ciCheckUrls.runId, plan.runId)),
    tx.delete(ciCheckFindings).where(eq(ciCheckFindings.runId, plan.runId)),
    ...(urls.length
      ? [
          tx.insert(ciCheckUrls).values(
            urls.map((url) => ({
              id: crypto.randomUUID(),
              runId: plan.runId,
              projectId: plan.projectId,
              path: url.path,
              reason: url.reason,
              sourceFile: url.file ?? null,
              baseStatus: url.baseStatus,
              previewStatus: url.previewStatus,
              clicks28d: url.clicks,
              impressions28d: url.impressions,
            })),
          ),
        ]
      : []),
    ...(findings.length
      ? [
          tx.insert(ciCheckFindings).values(
            findings.map((finding) => ({
              id: crypto.randomUUID(),
              runId: plan.runId,
              projectId: plan.projectId,
              path: finding.path,
              rule: finding.rule,
              severity: finding.severity,
              beforeValue: finding.before,
              afterValue: finding.after,
              message: finding.message,
            })),
          ),
        ]
      : []),
    tx
      .update(ciCheckRuns)
      .set({
        status: "succeeded",
        blockingCount: blocking.length,
        warningCount: findings.length - blocking.length,
        urlCount: urls.length,
        finishedAt: new Date().toISOString(),
      })
      .where(eq(ciCheckRuns.id, plan.runId)),
  ]);
}

export async function failCheck(runId: string, error: unknown) {
  await db
    .update(ciCheckRuns)
    .set({
      status: "failed",
      error: error instanceof Error ? error.message.slice(0, 300) : "Failed",
      finishedAt: new Date().toISOString(),
    })
    .where(eq(ciCheckRuns.id, runId));
}

/** Starts the run's Workflow; a run without the binding stays queued. */
export async function startCheckWorkflow(runId: string) {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- declared in wrangler.jsonc; absent in tests and self-hosted installs without workflows
  const workflow = (env as { SEO_CHECK_WORKFLOW?: Workflow<{ runId: string }> })
    .SEO_CHECK_WORKFLOW;
  await workflow
    ?.create({ id: runId, params: { runId } })
    .catch(() => undefined);
}
