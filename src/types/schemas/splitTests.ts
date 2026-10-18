import { z } from "zod";
import { SPLIT_TEST_FIELDS } from "@/db/split-tests.schema";

// RFC-0011 5.9: the split test forms.
const project = z.object({ projectId: z.string().min(1) });
export const splitTestProjectSchema = project;
export const splitTestSchema = project.extend({ testId: z.string().min(1) });
export const openSplitTestPullSchema = splitTestSchema.extend({
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
});
export type CreateSplitTestInput = z.infer<typeof createSplitTestSchema>;

// RFC-0011 5.7: the end actions.
export const splitTestEndSchema = splitTestSchema.extend({
  action: z.enum(["apply", "remove"]),
});
export const endSplitTestSchema = splitTestEndSchema.extend({
  hash: z.string().regex(/^[0-9a-f]{64}$/),
});
