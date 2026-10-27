import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { ciCheckFindings, ciCheckRuns, ciCheckUrls } from "@/db/schema";
import { assetSize, linkStatus, fetchSnapshot } from "./pageSnapshot";
import { assetWeight, mixedContent, WEIGHED } from "./assetRules";
import { checkAccessibility } from "./accessibilityPack";
import { pageUrl, previewAccess, type CheckPlan } from "./seoCheckPlan";
import { isPlatformHost } from "./previewHosts";
import { renderPages } from "./seoCheckRender";
import { compareSecurity } from "./securityRules";
import {
  comparePage,
  compareSite,
  shrunk,
  weigh,
  type Finding,
  type Snapshot,
} from "./seoRules";

// RFC-0010 5.2 to 5.8: the steps of one SeoCheckWorkflow run.
const PARALLEL_PER_HOST = 4;

type PlannedUrl = CheckPlan["urls"][number];
export type BatchResult = {
  urls: Array<
    PlannedUrl & { baseStatus: number | null; previewStatus: number | null }
  >;
  findings: Finding[];
  linksChecked: number;
  pagesRendered: number;
  assetsChecked?: number;
  accessibilityChecked?: number;
};

/** 5.13: the raw HTML looks client-rendered, or lost half its text. */
const flagged = (base: Snapshot, preview: Snapshot) =>
  Boolean(
    preview.page &&
    (preview.page.shell || (base.page && shrunk(base.page, preview.page))),
  );

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
  budget: {
    links: number;
    renders: number;
    assets?: number;
    accessibility?: number;
  },
): Promise<BatchResult> {
  const linkBudget = budget.links;
  const { access } = await previewAccess(plan);
  const fetched = await inPool(batch, async (url) => ({
    url,
    base: await fetchSnapshot(
      pageUrl(plan.baseOrigin, url.path, plan.trailingSlash),
      null,
    ),
    preview: await fetchSnapshot(
      pageUrl(plan.previewOrigin, url.path, plan.trailingSlash),
      access,
    ),
  }));
  // A renderer cannot carry the preview access secret, so protected
  // previews keep the raw comparison.
  const toRender =
    plan.renderedMode && !access
      ? fetched
          .filter((page) => flagged(page.base, page.preview))
          .slice(0, budget.renders)
          .map((page) => page.url.path)
      : [];
  const rendered = await renderPages(plan, toRender);
  const pages = fetched.map((page) => {
    const facts = rendered.get(page.url.path);
    return facts
      ? {
          url: page.url,
          base: { ...page.base, page: facts.base },
          preview: { ...page.preview, page: facts.preview },
        }
      : page;
  });
  const findings: Finding[] = [];
  let linksChecked = 0;
  const seo = plan.packs.includes("seo");
  // RFC-0015 5.3: with the links pack, a broken new link blocks.
  const links = plan.packs.includes("links");
  // RFC-0015 5.3: subresource sizes, one HEAD each, within the run budget.
  const sizes = new Map<string, number | null>();
  const wanted = links
    ? [
        ...new Set(
          pages.flatMap(({ base, preview }) =>
            [...(base.page?.assets ?? []), ...(preview.page?.assets ?? [])]
              .filter((asset) => WEIGHED.has(asset.kind))
              .map((asset) => asset.url),
          ),
        ),
      ].slice(0, budget.assets ?? 0)
    : [];
  const measured = await inPool(wanted, (url) => assetSize(url, access));
  wanted.forEach((url, index) => sizes.set(url, measured[index]));
  // RFC-0015 5.3: axe-core on pages that loaded on both hosts.
  const a11yPaths = plan.packs.includes("accessibility")
    ? pages
        .filter(
          ({ base, preview }) => base.status === 200 && preview.status === 200,
        )
        .map(({ url }) => url.path)
        .slice(0, budget.accessibility ?? 0)
    : [];
  findings.push(
    ...(await checkAccessibility(plan, a11yPaths, access !== null)),
  );
  for (const { url, base, preview } of pages) {
    if (seo)
      findings.push(
        ...comparePage(base, preview, {
          path: url.path,
          baseOrigin: plan.baseOrigin,
          previewOrigin: plan.previewOrigin,
          checkRobotsHeader: plan.checkRobotsHeader,
        }),
      );
    if (plan.packs.includes("security"))
      findings.push(
        ...compareSecurity(base, preview, {
          path: url.path,
          platformPreview: isPlatformHost(new URL(plan.previewOrigin).hostname),
        }),
      );
    if (links)
      findings.push(
        ...mixedContent(base.page, preview.page, {
          path: url.path,
          previewOrigin: plan.previewOrigin,
        }),
        ...assetWeight(base.page, preview.page, sizes, {
          path: url.path,
          imageMaxKb: plan.budgets.imageMaxKb,
        }),
      );
    if (!seo && !links) continue;
    const known = new Set(base.page?.internalLinks ?? []);
    const added = (preview.page?.internalLinks ?? []).filter(
      (link) => !known.has(link),
    );
    const checks = added.slice(0, Math.max(0, linkBudget - linksChecked));
    linksChecked += checks.length;
    const statuses = await inPool(checks, (link) =>
      linkStatus(pageUrl(plan.previewOrigin, link, plan.trailingSlash), access),
    );
    checks.forEach((link, index) => {
      const status = statuses[index];
      if (status && status >= 400)
        findings.push({
          path: url.path,
          rule: "broken-internal-link",
          pack: links ? "links" : "seo",
          severity: links ? "blocking" : "warning",
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
    pagesRendered: toRender.length,
    assetsChecked: wanted.length,
    accessibilityChecked: a11yPaths.length,
  };
}

/**
 * RFC-0015: response headers are usually set for the whole site, so each
 * change of one header shows once, on the first page that has it.
 */
function siteWide(findings: Finding[]) {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    if (
      finding.pack !== "security" &&
      finding.rule !== "accessibility-not-checked"
    )
      return true;
    const key = `${finding.rule} ${finding.before} ${finding.after}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    siteWide([
      ...(plan.packs.includes("seo")
        ? compareSite({
            paths: plan.urls.map((url) => url.path),
            baseAllows: (path) =>
              plan.urls.find((url) => url.path === path)?.baseAllowed ?? true,
            previewAllows: (path) =>
              plan.urls.find((url) => url.path === path)?.previewAllowed ??
              true,
            baseSitemapCount: plan.baseSitemapCount,
            previewSitemapCount: plan.previewSitemapCount,
          })
        : []),
      ...batches.flatMap((batch) => batch.findings),
      ...(plan.previewAccessWithheld
        ? [
            {
              path: "/",
              rule: "preview-access-not-sent",
              pack: "seo" as const,
              severity: "warning" as const,
              before: null,
              after: null,
              message: `Preview access was not sent, because ${new URL(plan.previewOrigin).hostname} is not your project's domain or a preview host you added in Project settings > SEO checks.`,
            },
          ]
        : []),
    ]),
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
              pack: finding.pack ?? "seo",
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
