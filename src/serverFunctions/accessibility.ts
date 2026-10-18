import { createServerFn } from "@tanstack/react-start";
import { AccessibilityFixService } from "@/server/features/accessibility/AccessibilityFixService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { accessibilityFixInputSchema } from "@/types/schemas/accessibility";

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
