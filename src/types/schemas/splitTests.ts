import { z } from "zod";
import { SPLIT_TEST_FIELDS } from "@/db/split-tests.schema";

// RFC-0011 5.9: the split test forms.
const project = z.object({ projectId: z.string().min(1) });
export const splitTestProjectSchema = project;
export const splitTestSchema = project.extend({ testId: z.string().min(1) });
// RFC-0011 phase 2: the pattern Relay drafts into the template.
const variantDraftSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.enum(["suffix", "prefix"]),
    text: z.string().min(1).max(60),
  }),
  z.object({
    kind: z.literal("swap"),
    expression: z.string().trim().min(1).max(100),
  }),
]);
export const previewSplitTestPullSchema = splitTestSchema.extend({
  draft: variantDraftSchema.optional(),
});
export const openSplitTestPullSchema = previewSplitTestPullSchema.extend({
  hash: z.string().regex(/^[0-9a-f]{64}$/),
});
export const confirmSplitTestDeploymentSchema = splitTestSchema.extend({
  attest: z.boolean(),
});
export const createSplitTestSchema = project.extend({
  name: z.string().trim().min(1).max(120),
  hypothesis: z.string().trim().min(1).max(500),
  field: z.enum(SPLIT_TEST_FIELDS),
  pagePattern: z
    .string()
    .trim()
    .max(200)
    .regex(
      /^\^\//,
      "Start the pattern with ^/, for example ^/integrations/[^/]+$.",
    )
    .refine((value) => {
      try {
        return new RegExp(value).source.length > 0;
      } catch {
        return false;
      }
    }, "Enter a valid regular expression."),
  // RFC-0012 phase 2: test the chosen conversion instead of clicks.
  metric: z.enum(["clicks", "conversions"]).default("clicks"),
});
export type CreateSplitTestInput = z.input<typeof createSplitTestSchema>;
export const backtestPatternSchema = createSplitTestSchema.pick({
  projectId: true,
  pagePattern: true,
});

// RFC-0011 5.7: the end actions.
export const splitTestEndSchema = splitTestSchema.extend({
  action: z.enum(["apply", "remove"]),
});
export const endSplitTestSchema = splitTestEndSchema.extend({
  hash: z.string().regex(/^[0-9a-f]{64}$/),
});
