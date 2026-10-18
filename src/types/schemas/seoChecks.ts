import { z } from "zod";

// RFC-0010 5.2: the body that the GitHub Action posts.
export const createCheckInputSchema = z.object({
  previewUrl: z.url().max(2000),
  repository: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .max(200),
  pullRequest: z.number().int().positive().nullish(),
  headSha: z.string().regex(/^[0-9a-f]{40}$/),
  changedFiles: z.array(z.string().min(1).max(500)).max(300).default([]),
  override: z.boolean().default(false),
});
export type CreateCheckInput = z.infer<typeof createCheckInputSchema>;
