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

// RFC-0010 5.11: Project settings > SEO checks.
const project = z.object({ projectId: z.string().min(1) });
export const seoCheckProjectSchema = project;
export const seoCheckRunSchema = project.extend({ runId: z.string().min(1) });
export const createCiTokenSchema = project.extend({
  name: z.string().trim().min(1).max(80),
});
export const revokeCiTokenSchema = project.extend({
  tokenId: z.string().min(1),
});
export const addPreviewHostSchema = project.extend({
  host: z.string().trim().min(3).max(253),
});
export const removePreviewHostSchema = project.extend({
  hostId: z.string().min(1),
});
export const setPreviewAccessSchema = project.extend({
  access: z
    .discriminatedUnion("kind", [
      z.object({
        kind: z.literal("header"),
        headerName: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9-]{1,100}$/),
        value: z.string().min(1).max(500),
      }),
      z.object({
        kind: z.literal("cf_access"),
        clientId: z.string().min(1).max(200),
        clientSecret: z.string().min(1).max(500),
      }),
    ])
    .nullable(),
});
export const changeIgnoreSchema = project.extend({
  add: z
    .object({
      rule: z.string().regex(/^[a-z0-9-]{3,40}$/),
      pathPattern: z.string().trim().min(1).max(300),
    })
    .optional(),
  removeId: z.string().min(1).optional(),
});
export const saveSeoCheckSettingsSchema = project.extend({
  raiseOnHighTraffic: z.boolean(),
  checkPreviewRobotsHeader: z.boolean(),
  renderedMode: z.boolean(),
});
