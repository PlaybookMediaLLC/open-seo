import { AccessibilityCheckService } from "@/server/features/accessibility/AccessibilityCheckService";
import { AccessibilityFixService } from "@/server/features/accessibility/AccessibilityFixService";
import { AltTextDraftService } from "@/server/features/accessibility/AltTextDraftService";
import { PerformanceResultService } from "@/server/features/performance/PerformanceResultService";
import type { INTRUDER } from "./tenancy-test-calls";

/** RFC-0013 and RFC-0014: the accessibility and performance services. */
export function accessibilityCalls(
  projectId: string,
  experimentId: string,
  ctx: typeof INTRUDER,
) {
  const opportunity = {
    projectId,
    opportunityId: "x",
    expectedOpportunityVersion: 1,
  };
  return {
    AccessibilityFixService: {
      prepare: () =>
        AccessibilityFixService.prepare(ctx, {
          ...opportunity,
          fix: { kind: "lang", language: "en" },
        }),
      suggestName: () =>
        AccessibilityFixService.suggestName(ctx, {
          projectId,
          opportunityId: "x",
        }),
    },
    AltTextDraftService: {
      draft: () => AltTextDraftService.draft(ctx, opportunity),
    },
    // RFC-0014: the field result of a performance item.
    PerformanceResultService: {
      get: () =>
        PerformanceResultService.get(ctx, { projectId, opportunityId: "x" }),
      refresh: () =>
        PerformanceResultService.refresh(ctx, {
          projectId,
          opportunityId: "x",
        }),
    },
    AccessibilityCheckService: {
      check: () =>
        AccessibilityCheckService.check(ctx, { projectId, experimentId }),
      latest: () =>
        AccessibilityCheckService.latest(ctx, { projectId, experimentId }),
      trend: () => AccessibilityCheckService.trend(ctx, projectId),
      statement: () => AccessibilityCheckService.statement(ctx, projectId),
    },
  };
}
