import { z } from "zod";

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
