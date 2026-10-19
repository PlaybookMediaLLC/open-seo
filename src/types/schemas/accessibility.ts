import { z } from "zod";
import { draftAnchorInputSchema } from "./proposalDrafts";

// RFC-0013 5.4: the person's choices for an accessibility fix in code.
export const accessibilityFixInputSchema = z.object({
  projectId: z.string().min(1),
  opportunityId: z.string().min(1),
  expectedOpportunityVersion: z.number().int().positive(),
  fix: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("alt"),
      decorative: z.boolean(),
      text: z.string().max(150).optional(),
    }),
    z.object({
      kind: z.literal("lang"),
      // A BCP 47 tag such as "en" or "fr-CA".
      language: z
        .string()
        .regex(
          /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/,
          "Enter a language tag such as en or fr-CA.",
        ),
    }),
    // Phase 2: the aria-label of a link, button or form field.
    z.object({
      kind: z.literal("name"),
      text: z
        .string()
        .trim()
        .min(1, "Enter the name.")
        .max(100)
        .regex(/^[^\p{Cc}]*$/u, "Remove the control characters."),
    }),
  ]),
  /** The alt text draft the person started from, if any. */
  draftId: z.string().min(1).optional(),
});
export type AccessibilityFixInput = z.infer<typeof accessibilityFixInputSchema>;

/** RFC-0013 5.5: one check of a fixed cluster on the live pages. */
export type AccessibilityFixCheck = {
  id: string;
  ruleId: string;
  checkedAt: string;
  pages: Array<{
    url: string;
    outcome: "passed" | "failed" | "unchecked";
    detail: string | null;
  }>;
};

export const accessibilityProjectInputSchema = z.object({
  projectId: z.string().min(1),
});

/** RFC-0013 5.5: violations per audit, and fixes that passed their check. */
export type AccessibilityTrend = {
  audits: Array<{
    auditId: string;
    startedAt: string;
    pagesChecked: number;
    seriousViolations: number;
  }>;
  fixesPassed: number;
};

/** RFC-0013 5.4: an alt text draft; phase 2 lets the model see the image. */
export const draftAltTextInputSchema = draftAnchorInputSchema.extend({
  vision: z.boolean().default(false),
});
