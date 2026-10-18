import { createServerFn } from "@tanstack/react-start";
import { AccessibilityFixService } from "@/server/features/accessibility/AccessibilityFixService";
import { AltTextDraftService } from "@/server/features/accessibility/AltTextDraftService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { accessibilityFixInputSchema } from "@/types/schemas/accessibility";
import { draftAnchorInputSchema } from "@/types/schemas/proposalDrafts";

// RFC-0013 5.4: prepare an alt text or page language fix for review.
export const prepareAccessibilityFix = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(accessibilityFixInputSchema)
  .handler(({ context, data }) =>
    AccessibilityFixService.prepare(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

export const draftAltText = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(draftAnchorInputSchema)
  .handler(({ context, data }) =>
    AltTextDraftService.draft(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
