import { env, type WorkflowStep } from "cloudflare:workers";
import { and, asc, eq } from "drizzle-orm";
import { chunk, sortBy } from "remeda";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  auditAccessibilityResults,
  auditAccessibilityTargets,
  auditAccessibilityViolations,
  auditPages,
} from "@/db/schema";
import { assertSpendRoom } from "@/server/billing/spendAdmission";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { urlJoinKey } from "@/server/features/opportunities/services/detectors/shared";
import { ProjectContextRepository } from "@/server/features/project-context/repositories/ProjectContextRepository";
import {
  lockRenderingCredits,
  settleRenderingLocks,
} from "@/server/lib/audit/rendering-billing";
import { detectUrlTemplate } from "@/server/lib/audit/url-utils";
import { pgStep } from "@/server/workflows/pgStep";
import { DB_STEP } from "@/server/workflows/auditStepConfigs";
import { estimateRenderingCredits } from "@/shared/audit-rendering";
import { clusterKey, loadAxe, runAxe } from "./axeRun";

// RFC-0013 5.2: after Lighthouse, axe-core checks the pages that matter:
// key pages, the 20 pages with the most organic clicks, and one page per
// route template, at most 50. Browser time is held and billed like audit
// rendering; without room in the limits or the credits, the step skips.
const MAX_PAGES = 50;
const PAGES_PER_STEP = 5;
const VIOLATION_ROWS_PER_INSERT = 9;
const CHECK_STEP = {
  retries: { limit: 0, delay: "1 second" },
  timeout: "10 minutes",
} as const;

type Page = { id: string; url: string };

/** The top-clicked pages that the app worker saved when the audit started. */
async function topClickKeys(auditId: string) {
  const rows = await db
    .select({ url: auditAccessibilityTargets.url })
    .from(auditAccessibilityTargets)
    .where(eq(auditAccessibilityTargets.auditId, auditId));
  return rows.flatMap((row) => urlJoinKey(row.url) ?? []);
}

/** The pages to check, in priority order. */
async function selectAccessibilityPages(
  auditId: string,
  projectId: string,
): Promise<Page[]> {
  const [pages, keyPages, topClicks] = await Promise.all([
    db
      .select({ id: auditPages.id, url: auditPages.url })
      .from(auditPages)
      .where(
        and(eq(auditPages.auditId, auditId), eq(auditPages.statusCode, 200)),
      )
      .orderBy(asc(auditPages.url)),
    ProjectContextRepository.listKeyPages(projectId),
    topClickKeys(auditId),
  ]);
  const byKey = new Map(pages.map((page) => [urlJoinKey(page.url), page]));
  const chosen = new Map<string, Page>();
  const add = (page: Page | undefined) => {
    if (page && chosen.size < MAX_PAGES) chosen.set(page.id, page);
  };
  for (const page of keyPages) add(byKey.get(urlJoinKey(page.url)));
  for (const key of topClicks) add(byKey.get(key));
  const templates = new Set<string>();
  for (const page of sortBy(pages, (item) => item.url.length)) {
    const template = detectUrlTemplate(new URL(page.url).pathname);
    if (templates.has(template)) continue;
    templates.add(template);
    add(page);
  }
  return [...chosen.values()];
}

async function storeResult(
  auditId: string,
  page: Page,
  outcome: Awaited<ReturnType<typeof runAxe>>,
) {
  const resultId = crypto.randomUUID();
  const violations =
    "result" in outcome
      ? await Promise.all(
          outcome.result.violations.flatMap((violation) =>
            violation.nodes.map(async (node) => ({
              id: crypto.randomUUID(),
              resultId,
              ruleId: violation.id,
              impact: violation.impact,
              wcagTags: violation.tags.join(" ").slice(0, 300),
              targetSelector: node.target,
              htmlSnippet: node.html,
              failureSummary: node.summary,
              clusterKey: await clusterKey(
                violation.id,
                node.target,
                node.html,
              ),
            })),
          ),
        )
      : [];
  await runBatch((tx) => [
    tx.insert(auditAccessibilityResults).values({
      id: resultId,
      auditId,
      pageId: page.id,
      axeVersion: "result" in outcome ? outcome.result.version : "",
      ranAt: new Date().toISOString(),
      violationCount: violations.length,
      error: "error" in outcome ? outcome.error : null,
    }),
    ...chunk(violations, VIOLATION_ROWS_PER_INSERT).map((rows) =>
      tx.insert(auditAccessibilityViolations).values(rows),
    ),
  ]);
}

export async function runAccessibilityStep(
  step: WorkflowStep,
  input: {
    auditId: string;
    projectId: string;
    billingCustomer: BillingCustomerContext;
  },
) {
  const browser = env.BROWSER;
  if (!browser) return;
  const { auditId, billingCustomer } = input;
  const pages = await pgStep(step, "accessibility-select", DB_STEP, () =>
    selectAccessibilityPages(auditId, input.projectId),
  );
  if (!pages.length) return;
  const hold = await pgStep(step, "accessibility-hold", DB_STEP, async () => {
    try {
      await assertSpendRoom(
        {
          organizationId: billingCustomer.organizationId,
          projectId: input.projectId,
        },
        estimateRenderingCredits(pages.length).high,
      );
      return {
        locks: await lockRenderingCredits({
          customer: billingCustomer,
          auditId,
          maxPages: pages.length,
        }),
      };
    } catch {
      return null;
    }
  });
  if (!hold) return;
  let attempts = 0;
  try {
    for (const [index, group] of chunk(pages, PAGES_PER_STEP).entries())
      attempts += await pgStep(
        step,
        `accessibility-check-${index}`,
        CHECK_STEP,
        async () => {
          const source = await loadAxe();
          for (const page of group)
            await storeResult(
              auditId,
              page,
              source
                ? await runAxe(browser, page.url, source)
                : {
                    error:
                      "axe-core could not be loaded. The check runs again on the next audit.",
                  },
            );
          return group.length;
        },
      );
  } finally {
    if (hold.locks.length)
      await pgStep(step, "accessibility-settle", DB_STEP, () =>
        settleRenderingLocks({
          customer: billingCustomer,
          auditId,
          locks: hold.locks,
          usage: { cloudflareAttempts: attempts, contextCredits: 0 },
        }),
      );
  }
}
