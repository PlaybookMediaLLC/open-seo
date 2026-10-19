import { createServerFn } from "@tanstack/react-start";
import { DocsSettingsService } from "@/server/features/docs/DocsSettingsService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  docsProjectSchema,
  docsSettingsInputSchema,
} from "@/types/schemas/docs";

// RFC-0017 5.2: the docs paths and the docs index.
export const getDocsSettings = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(docsProjectSchema)
  .handler(({ context }) =>
    DocsSettingsService.get(context, context.projectId),
  );

export const saveDocsSettings = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(docsSettingsInputSchema)
  .handler(({ context, data }) =>
    DocsSettingsService.save(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

export const indexDocsNow = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(docsProjectSchema)
  .handler(({ context }) =>
    DocsSettingsService.indexNow(context, context.projectId),
  );
