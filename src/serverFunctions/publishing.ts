import { createServerFn } from "@tanstack/react-start";
import { MetadataExecutionService } from "@/server/features/publishing/MetadataExecutionService";
import { MetadataProposalService } from "@/server/features/publishing/MetadataProposalService";
import { PublishingRecoveryService } from "@/server/features/publishing/PublishingRecoveryService";
import { PublishingConnectionService } from "@/server/features/publishing/PublishingConnectionService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  connectPublishingInputSchema,
  executeProposalInputSchema,
  prepareProposalInputSchema,
  publishingOpportunityInputSchema,
  publishingProjectInputSchema,
  recoverPublishingInputSchema,
} from "@/types/schemas/publishing";

export const getPublishingConnection = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(publishingProjectInputSchema)
  .handler(({ context }) =>
    PublishingConnectionService.get(context, context.projectId),
  );
export const connectPublishingRepository = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(connectPublishingInputSchema)
  .handler(({ context, data }) =>
    PublishingConnectionService.connect(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
export const disconnectPublishingRepository = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(publishingProjectInputSchema)
  .handler(({ context }) =>
    PublishingConnectionService.disconnect(context, context.projectId),
  );
export const getPublishingOpportunity = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(publishingOpportunityInputSchema)
  .handler(({ context, data }) =>
    MetadataProposalService.get(context, context.projectId, data.opportunityId),
  );
export const prepareMetadataProposal = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(prepareProposalInputSchema)
  .handler(({ context, data }) =>
    MetadataProposalService.prepare(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
export const executeMetadataProposal = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(executeProposalInputSchema)
  .handler(({ context, data }) =>
    MetadataExecutionService.execute(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

export const recoverPublishingOpportunity = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(recoverPublishingInputSchema)
  .handler(({ context, data }) =>
    PublishingRecoveryService.recover(context, {
      ...data,
      projectId: context.projectId,
    }),
  );
