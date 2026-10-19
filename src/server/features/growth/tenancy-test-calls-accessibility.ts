import { AccessibilityCheckService } from "@/server/features/accessibility/AccessibilityCheckService";
import { AccessibilityFixService } from "@/server/features/accessibility/AccessibilityFixService";
import { AltTextDraftService } from "@/server/features/accessibility/AltTextDraftService";
import { PerformanceFixService } from "@/server/features/performance/PerformanceFixService";
import { PerformanceLabService } from "@/server/features/performance/PerformanceLabService";
import { PerformanceResultService } from "@/server/features/performance/PerformanceResultService";
import { PerformanceVitalsService } from "@/server/features/performance/PerformanceVitalsService";
import { RevenueConnectionService } from "@/server/features/revenue/RevenueConnectionService";
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
    PerformanceFixService: {
      prepare: () =>
        PerformanceFixService.prepare(ctx, {
          ...opportunity,
          fix: "script_strategy",
        }),
    },
    PerformanceLabService: {
      state: () =>
        PerformanceLabService.state(ctx, { projectId, opportunityId: "x" }),
      run: () =>
        PerformanceLabService.run(ctx, { projectId, opportunityId: "x" }),
    },
    // RFC-0016: the read-only Stripe connection.
    RevenueConnectionService: {
      status: () => RevenueConnectionService.status(ctx, projectId),
      connect: () =>
        RevenueConnectionService.connect(ctx, {
          projectId,
          key: "rk_test_0123456789abcdef",
        }),
      disconnect: () => RevenueConnectionService.disconnect(ctx, projectId),
    },
    PerformanceVitalsService: {
      report: () => PerformanceVitalsService.report(ctx, projectId),
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
