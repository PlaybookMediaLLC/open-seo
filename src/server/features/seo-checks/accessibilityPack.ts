import { env } from "cloudflare:workers";
import {
  clusterKey,
  loadAxe,
  runAxe,
} from "@/server/features/accessibility/axeRun";
import {
  lockRenderingCredits,
  settleRenderingLocks,
} from "@/server/lib/audit/rendering-billing";
import { pageUrl, type CheckPlan } from "./seoCheckPlan";
import type { Finding } from "./seoRules";

// RFC-0015 5.3: the accessibility pack. axe-core runs on both versions of up
// to 10 pages a run, billed like audit rendering.
export const MAX_ACCESSIBILITY_PAGES = 10;
type AxeResult = Extract<
  Awaited<ReturnType<typeof runAxe>>,
  { result: unknown }
>["result"];

/**
 * New violations on the preview: a cluster key that production does not
 * have, on a rule with more nodes than production. The count guards
 * against class names that change between builds.
 */
export async function newViolations(
  base: AxeResult,
  preview: AxeResult,
  path: string,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const violation of preview.violations) {
    if (violation.impact === "minor") continue;
    const before = base.violations.find((item) => item.id === violation.id);
    if (violation.nodes.length <= (before?.nodes.length ?? 0)) continue;
    const known = new Set(
      await Promise.all(
        (before?.nodes ?? []).map((node) =>
          clusterKey(violation.id, node.target, node.html),
        ),
      ),
    );
    let added = null;
    for (const node of violation.nodes)
      if (!known.has(await clusterKey(violation.id, node.target, node.html))) {
        added = node;
        break;
      }
    if (!added) continue;
    findings.push({
      path,
      rule: violation.id,
      pack: "accessibility",
      severity: violation.impact === "moderate" ? "warning" : "blocking",
      before: before ? `${before.nodes.length} elements` : null,
      after: `${added.target}: ${added.html}`.slice(0, 300),
      message:
        added.summary.replace(/\s+/g, " ").trim().slice(0, 300) ||
        `axe-core rule ${violation.id} fails on a new element.`,
    });
  }
  return findings;
}

/** The pack's findings for some pages of a batch. */
export async function checkAccessibility(
  plan: Pick<
    CheckPlan,
    | "runId"
    | "projectId"
    | "organizationId"
    | "baseOrigin"
    | "previewOrigin"
    | "trailingSlash"
  >,
  paths: string[],
  protectedPreview: boolean,
): Promise<Finding[]> {
  if (!paths.length) return [];
  const skipped = (reason: string): Finding[] => [
    {
      path: paths[0],
      rule: "accessibility-not-checked",
      pack: "accessibility",
      severity: "warning",
      before: null,
      after: null,
      message: reason,
    },
  ];
  // A renderer cannot carry the preview access secret (RFC-0010 5.13).
  if (protectedPreview)
    return skipped(
      "The preview is protected, so the browser could not load it. Accessibility was not checked.",
    );
  const browser = env.BROWSER;
  const source = browser ? await loadAxe() : null;
  if (!browser || !source)
    return skipped(
      "The browser was not available. Accessibility was not checked.",
    );
  const customer = {
    userId: "system",
    userEmail: "system@openseo.so",
    organizationId: plan.organizationId,
    projectId: plan.projectId,
  };
  const renders = paths.length * 2;
  let locks: Awaited<ReturnType<typeof lockRenderingCredits>>;
  try {
    locks = await lockRenderingCredits({
      customer,
      auditId: plan.runId,
      maxPages: renders,
    });
  } catch {
    return skipped(
      "Your credits or spending limits had no room for the browser. Accessibility was not checked.",
    );
  }
  const findings: Finding[] = [];
  try {
    for (const path of paths) {
      const [base, preview] = await Promise.all([
        runAxe(
          browser,
          pageUrl(plan.baseOrigin, path, plan.trailingSlash),
          source,
        ),
        runAxe(
          browser,
          pageUrl(plan.previewOrigin, path, plan.trailingSlash),
          source,
        ),
      ]);
      if ("result" in base && "result" in preview)
        findings.push(
          ...(await newViolations(base.result, preview.result, path)),
        );
    }
  } finally {
    await settleRenderingLocks({
      customer,
      auditId: plan.runId,
      locks,
      usage: { cloudflareAttempts: renders, contextCredits: 0 },
    });
  }
  return findings;
}
