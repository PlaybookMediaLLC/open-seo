import { createServerFn } from "@tanstack/react-start";
import { CopyLocatorService } from "@/server/features/publishing/CopyLocatorService";
import { CopyProposalService } from "@/server/features/publishing/CopyProposalService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  locateCopyInputSchema,
  pageTextsInputSchema,
  prepareCopyInputSchema,
} from "@/types/schemas/copyText";

// RFC-0012 5.4: pick a text on the live page and find it in the repository.
export const listPageTexts = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(pageTextsInputSchema)
  .handler(({ context, data }) =>
    CopyLocatorService.pageTexts(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

export const locateCopyText = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(locateCopyInputSchema)
  .handler(({ context, data }) =>
    CopyLocatorService.locate(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

export const prepareCopyProposal = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(prepareCopyInputSchema)
  .handler(({ context, data }) =>
    CopyProposalService.prepare(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
