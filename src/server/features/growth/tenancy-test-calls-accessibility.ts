import { DocsDetectionService } from "@/server/features/docs/DocsDetectionService";
import { DocsDraftService } from "@/server/features/docs/DocsDraftService";
import { DocsEditService } from "@/server/features/docs/DocsEditService";
import { DocsResultService } from "@/server/features/docs/DocsResultService";
import { SupportSourceService } from "@/server/features/support/SupportSourceService";
import { DocsSettingsService } from "@/server/features/docs/DocsSettingsService";
import { AccessibilityCheckService } from "@/server/features/accessibility/AccessibilityCheckService";
import { AccessibilityFixService } from "@/server/features/accessibility/AccessibilityFixService";
import { AltTextDraftService } from "@/server/features/accessibility/AltTextDraftService";
import { PerformanceFixService } from "@/server/features/performance/PerformanceFixService";
import { PerformanceLabService } from "@/server/features/performance/PerformanceLabService";
import { PerformanceResultService } from "@/server/features/performance/PerformanceResultService";
import { PerformanceVitalsService } from "@/server/features/performance/PerformanceVitalsService";
import { RevenueConnectionService } from "@/server/features/revenue/RevenueConnectionService";
import { RevenueReportService } from "@/server/features/revenue/RevenueReportService";
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
    RevenueReportService: {
      report: () => RevenueReportService.report(ctx, { projectId, days: 90 }),
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
    // RFC-0017: the docs paths and the docs index.
    DocsSettingsService: {
      get: () => DocsSettingsService.get(ctx, projectId),
      save: () =>
        DocsSettingsService.save(ctx, {
          projectId,
          pathPrefix: "/docs/",
          directory: "content/docs",
        }),
      pages: () => DocsSettingsService.pages(ctx, projectId),
      indexNow: () => DocsSettingsService.indexNow(ctx, projectId),
    },
    DocsEditService: {
      prepare: () =>
        DocsEditService.prepare(ctx, {
          projectId,
          opportunityId: "x",
          expectedOpportunityVersion: 1,
          filePath: "content/docs/a.mdx",
          edit: { kind: "add_faq_item", heading: "FAQ", item: "x" },
        }),
    },
    DocsDetectionService: {
      detect: () => DocsDetectionService.detect(ctx, projectId),
    },
    SupportSourceService: {
      status: () => SupportSourceService.status(ctx, projectId),
      connect: () => SupportSourceService.connect(ctx, projectId),
      disconnect: () => SupportSourceService.disconnect(ctx, projectId),
      processNow: () => SupportSourceService.processNow(ctx, projectId),
    },
    DocsResultService: {
      measure: () =>
        DocsResultService.measure(ctx, { projectId, experimentId }),
    },
    DocsDraftService: {
      draft: () =>
        DocsDraftService.draft(ctx, {
          ...opportunity,
          filePath: "content/docs/a.mdx",
          kind: "add_faq_item",
          target: "FAQ",
          facts: "",
        }),
    },
  };
}
