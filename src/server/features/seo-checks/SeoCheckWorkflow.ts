import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { pgStep } from "@/server/workflows/pgStep";
import { reportCheckRun } from "./githubAppMode";
import { MAX_RENDERED_PAGES } from "./seoCheckRender";
import { planCheck } from "./seoCheckPlan";
import {
  checkBatch,
  failCheck,
  finishCheck,
  type BatchResult,
} from "./seoCheckRun";

// RFC-0010: one SEO check run. The owner chose a Cloudflare Workflow over a
// Trigger.dev task, so checks run without another account.
const BATCH_SIZE = 10;
const LINK_BUDGET = 200;
// RFC-0015: subresource size requests per run.
const ASSET_BUDGET = 200;
const STEP = {
  retries: { limit: 2, delay: "10 seconds" as const },
  timeout: "5 minutes" as const,
};

export class SeoCheckWorkflow extends WorkflowEntrypoint<
  Env,
  { runId: string }
> {
  async run(event: WorkflowEvent<{ runId: string }>, step: WorkflowStep) {
    const { runId } = event.payload;
    try {
      const plan = await pgStep(step, "plan", STEP, () => planCheck(runId));
      const batches: BatchResult[] = [];
      let links = LINK_BUDGET;
      let renders = MAX_RENDERED_PAGES;
      let assets = ASSET_BUDGET;
      for (let index = 0; index < plan.urls.length; index += BATCH_SIZE) {
        const budget = { links, renders, assets };
        const result = await pgStep(step, `check-${index}`, STEP, () =>
          checkBatch(plan, plan.urls.slice(index, index + BATCH_SIZE), budget),
        );
        links -= result.linksChecked;
        renders -= result.pagesRendered;
        assets -= result.assetsChecked ?? 0;
        batches.push(result);
      }
      await pgStep(step, "finish", STEP, () => finishCheck(plan, batches));
    } catch (error) {
      await pgStep(step, "fail", STEP, () => failCheck(runId, error));
    }
    // RFC-0010 5.12: an App run reports back as a Check Run. A failed report
    // leaves the stored run as it is.
    await pgStep(step, "report", STEP, () => reportCheckRun(runId)).catch(
      () => undefined,
    );
  }
}
