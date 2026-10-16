import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { AppError } from "@/server/lib/errors";
import { OpportunityRepository } from "../repositories/OpportunityRepository";

export type OpportunityContext = Pick<
  EnsuredUserContext,
  "organizationId" | "userId" | "role"
>;

/** The project must belong to the caller's organization. */
export async function authorize(
  context: OpportunityContext,
  projectId: string,
) {
  const project = await ProjectRepository.getProjectForOrganization(
    projectId,
    context.organizationId,
  );
  if (!project) throw new AppError("NOT_FOUND", "Project not found.");
  return project;
}

export async function get(
  context: OpportunityContext,
  projectId: string,
  opportunityId: string,
) {
  await authorize(context, projectId);
  const detail = await OpportunityRepository.getDetail(
    projectId,
    opportunityId,
  );
  if (!detail) throw new AppError("NOT_FOUND", "Opportunity not found.");
  return detail;
}
