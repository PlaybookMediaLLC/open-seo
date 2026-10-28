import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { isEveryAppAuthMode } from "@/lib/auth-mode";
import { setMemberApproval } from "@/server/auth/member-approval";
import { PublishingApproverService } from "@/server/features/publishing/PublishingApproverService";
import { AppError } from "@/server/lib/errors";
import {
  requireAuthenticatedContext,
  requireProjectContext,
} from "@/serverFunctions/middleware";
import {
  memberApprovalInputSchema,
  publishingProjectInputSchema,
  savePublishingApproversInputSchema,
} from "@/types/schemas/publishing";

// RFC-0007 6.4-6.5: who may approve the pull requests Relay opens. Behind an
// Every App gateway the gateway owns the team, so neither list exists there.
function refuseBehindEveryAppGateway() {
  if (isEveryAppAuthMode(env.AUTH_MODE)) throw new AppError("NOT_FOUND");
}

export const setTeamMemberApproval = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(memberApprovalInputSchema)
  .handler(({ context, data }) => {
    refuseBehindEveryAppGateway();
    return setMemberApproval(context, data);
  });

export const getPublishingApprovers = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(publishingProjectInputSchema)
  .handler(({ context }) => {
    refuseBehindEveryAppGateway();
    return PublishingApproverService.list(context, context.projectId);
  });

export const savePublishingApprovers = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(savePublishingApproversInputSchema)
  .handler(({ context, data }) => {
    refuseBehindEveryAppGateway();
    return PublishingApproverService.save(context, {
      projectId: context.projectId,
      memberIds: data.memberIds,
    });
  });
