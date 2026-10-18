import { ConversionDetectionService } from "@/server/features/conversion/ConversionDetectionService";
import { ConversionGateService as conversion } from "@/server/features/conversion/ConversionGateService";
import { CopyDraftService } from "@/server/features/conversion/CopyDraftService";
import { CopyLocatorService } from "@/server/features/publishing/CopyLocatorService";
import { CopyProposalService } from "@/server/features/publishing/CopyProposalService";
import type { INTRUDER } from "./tenancy-test-calls";

/** RFC-0012: the conversion and page text services. */
export function conversionCalls(projectId: string, ctx: typeof INTRUDER) {
  return {
    ConversionGateService: {
      get: () => conversion.get(ctx, projectId),
      save: () =>
        conversion.save(ctx, {
          projectId,
          eventName: "sign_up",
          valueMinor: null,
          currency: null,
          channel: "organic_search",
        }),
    },
    ConversionDetectionService: {
      detect: () => ConversionDetectionService.detect(ctx, projectId),
    },
    CopyLocatorService: {
      pageTexts: () =>
        CopyLocatorService.pageTexts(ctx, { projectId, opportunityId: "x" }),
      locate: () =>
        CopyLocatorService.locate(ctx, {
          projectId,
          opportunityId: "x",
          text: "Book a call",
        }),
    },
    CopyProposalService: {
      prepare: () =>
        CopyProposalService.prepare(ctx, {
          projectId,
          opportunityId: "x",
          expectedOpportunityVersion: 1,
          edits: [{ text: "Book a call", newText: "Talk to sales" }],
          confirmSharedPages: false,
        }),
    },
    CopyDraftService: {
      draft: () =>
        CopyDraftService.draft(ctx, {
          projectId,
          opportunityId: "x",
          expectedOpportunityVersion: 1,
          text: "Book a call",
          blockKind: "button",
        }),
    },
  };
}
