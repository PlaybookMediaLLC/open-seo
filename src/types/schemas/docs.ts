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
