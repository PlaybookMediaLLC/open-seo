import { createServerFn } from "@tanstack/react-start";
import { DocsDetectionService } from "@/server/features/docs/DocsDetectionService";
import { DocsDraftService } from "@/server/features/docs/DocsDraftService";
import { DocsEditService } from "@/server/features/docs/DocsEditService";
import { DocsResultService } from "@/server/features/docs/DocsResultService";
import { DocsSettingsService } from "@/server/features/docs/DocsSettingsService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  docsDraftInputSchema,
  docsEditInputSchema,
  docsProjectSchema,
  docsSettingsInputSchema,
} from "@/types/schemas/docs";
import { experimentInputSchema } from "@/types/schemas/experiments";

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

// RFC-0017 5.3: one free docs run from Search Console, GA4 and the index.
export const findDocsOpportunities = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(docsProjectSchema)
  .handler(({ context }) =>
    DocsDetectionService.detect(context, context.projectId),
  );

// RFC-0017 5.5: the docs pages to edit, and one docs edit proposal.
export const getDocsPages = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(docsProjectSchema)
  .handler(({ context }) =>
    DocsSettingsService.pages(context, context.projectId),
  );

export const prepareDocsEdit = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(docsEditInputSchema)
  .handler(({ context, data }) =>
    DocsEditService.prepare(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

// RFC-0017 5.6: a checked Markdown draft from verified sources.
export const draftDocsText = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(docsDraftInputSchema)
  .handler(({ context, data }) =>
    DocsDraftService.draft(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

// RFC-0017 5.7: searches for the topic before and after a docs change.
export const measureDocsResult = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(experimentInputSchema)
  .handler(({ context, data }) =>
    DocsResultService.measure(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
