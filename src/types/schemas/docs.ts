import { z } from "zod";

// RFC-0017 5.2: where the docs live on the site and in the repository.
export const docsProjectSchema = z.object({ projectId: z.string().min(1) });
export const docsSettingsInputSchema = docsProjectSchema.extend({
  pathPrefix: z
    .string()
    .trim()
    .max(200)
    .regex(/^\/[A-Za-z0-9._~/-]*$/, "Start the docs path with /.")
    .transform((path) => (path.endsWith("/") ? path : `${path}/`)),
  directory: z
    .string()
    .trim()
    .max(300)
    .transform((path) => path.replace(/^\/+|\/+$/g, ""))
    .pipe(z.string().min(1, "Enter the docs directory.")),
});

// RFC-0017 5.5: the three docs edits.
const docsText = z.string().max(5_000);
const docsHeading = z.string().trim().min(1).max(300);
export const markdownEditSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("insert_section"),
    heading: docsHeading,
    markdown: docsText,
  }),
  z.object({
    kind: z.literal("add_faq_item"),
    heading: docsHeading,
    item: docsText,
  }),
  z.object({
    kind: z.literal("replace_paragraph"),
    before: docsText,
    after: docsText,
  }),
]);
export type MarkdownEdit = z.infer<typeof markdownEditSchema>;
export const docsEditInputSchema = docsProjectSchema.extend({
  opportunityId: z.string().min(1),
  expectedOpportunityVersion: z.number().int().positive(),
  filePath: z.string().min(1).max(500),
  edit: markdownEditSchema,
});
export type DocsEditInput = z.infer<typeof docsEditInputSchema>;
