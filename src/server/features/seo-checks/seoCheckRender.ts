import { env } from "cloudflare:workers";
import { assertSpendRoom } from "@/server/billing/spendAdmission";
import { RenderedPageService } from "@/server/lib/audit/rendered-page";
import {
  lockRenderingCredits,
  settleRenderingLocks,
} from "@/server/lib/audit/rendering-billing";
import { estimateRenderingCredits } from "@/shared/audit-rendering";
import { pageFacts } from "./pageSnapshot";
import type { CheckPlan } from "./seoCheckPlan";
import type { PageFacts } from "./seoRules";

// RFC-0010 5.13: rendered mode. A flagged page is rendered on both hosts in
// Cloudflare's browser, and the rules compare the rendered HTML. Context is
// not used: it costs more, and it would see the preview.
export const MAX_RENDERED_PAGES = 5;

/**
 * Rendered facts by path, for pages where both hosts rendered. Billed like
 * audit rendering; no room in the spend limits or the credits renders none.
 */
export async function renderPages(plan: CheckPlan, paths: string[]) {
  const rendered = new Map<string, { base: PageFacts; preview: PageFacts }>();
  const browser = env.BROWSER;
  if (!browser || !paths.length) return rendered;
  const customer = {
    userId: "system",
    userEmail: "system@openseo.so",
    organizationId: plan.organizationId,
    projectId: plan.projectId,
  };
  const renders = paths.length * 2;
  let locks: Awaited<ReturnType<typeof lockRenderingCredits>>;
  try {
    await assertSpendRoom(customer, estimateRenderingCredits(renders).high);
    locks = await lockRenderingCredits({
      customer,
      auditId: plan.runId,
      maxPages: renders,
    });
  } catch {
    return rendered;
  }
  const usage = { cloudflareAttempts: 0, contextCredits: 0 };
  const facts = async (url: string) => {
    try {
      const page = await RenderedPageService.renderPage(url, {
        browser,
        auditId: plan.runId,
        usage,
      });
      return pageFacts(page.html, url, page.status ?? 200);
    } catch {
      return null;
    }
  };
  try {
    await Promise.all(
      paths.map(async (path) => {
        const [base, preview] = await Promise.all([
          facts(`${plan.baseOrigin}${path}`),
          facts(`${plan.previewOrigin}${path}`),
        ]);
        if (base && preview) rendered.set(path, { base, preview });
      }),
    );
  } finally {
    await settleRenderingLocks({
      customer,
      auditId: plan.runId,
      locks,
      usage,
    });
  }
  return rendered;
}
