import { AccessibilityCheckService } from "@/server/features/accessibility/AccessibilityCheckService";
import { AccessibilityFixService } from "@/server/features/accessibility/AccessibilityFixService";
import { AltTextDraftService } from "@/server/features/accessibility/AltTextDraftService";
import type { INTRUDER } from "./tenancy-test-calls";

/** RFC-0013: the accessibility fix, draft and check services. */
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
    },
    AltTextDraftService: {
      draft: () => AltTextDraftService.draft(ctx, opportunity),
    },
    AccessibilityCheckService: {
      check: () =>
        AccessibilityCheckService.check(ctx, { projectId, experimentId }),
      latest: () =>
        AccessibilityCheckService.latest(ctx, { projectId, experimentId }),
    },
  };
}
