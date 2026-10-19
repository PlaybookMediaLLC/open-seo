import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { shiftGa4Date } from "@/server/features/ga4/services/Ga4Dates";
import { ExperimentRepository } from "@/server/features/experiments/repositories/ExperimentRepository";
import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import {
  authorizePublishing,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";
import { AppError } from "@/server/lib/errors";
import { termKey } from "./docsDetectors";
import { fetchSiteSearches } from "./docsGa4";
import { searchResult } from "./docsResult";

// GA4 can still change the last two days of a window.
const SETTLE_DAYS = 2;

/**
 * RFC-0017 5.7: site searches for the item's term in the 4 weeks before and
 * the 4 weeks after a docs change deployed. Read on request, not stored.
 */
async function measure(
  context: PublishingContext,
  input: { projectId: string; experimentId: string },
) {
  await authorizePublishing(context, input.projectId);
  const detail = await ExperimentRepository.get(
    input.projectId,
    input.experimentId,
  );
  if (!detail) throw new AppError("NOT_FOUND");
  if (detail.publishing.proposal.changeKind !== "markdown")
    throw new AppError(
      "VALIDATION_ERROR",
      "Only docs changes have a search result.",
    );
  const { deployedAt, opportunityId } = detail.experiment;
  if (!deployedAt) return { status: "not_deployed" as const };
  const [opportunity, connection] = await Promise.all([
    OpportunityRepository.getDetail(input.projectId, opportunityId),
    Ga4ConnectionRepository.getByProjectId(input.projectId),
  ]);
  const term = opportunity?.opportunity.query ?? null;
  if (!term) return { status: "no_term" as const };
  if (!connection) return { status: "no_ga4" as const };
  const deployed = deployedAt.slice(0, 10);
  const before = {
    startDate: shiftGa4Date(deployed, -28),
    endDate: shiftGa4Date(deployed, -1),
  };
  const after = { startDate: deployed, endDate: shiftGa4Date(deployed, 27) };
  const readyOn = shiftGa4Date(after.endDate, SETTLE_DAYS);
  if (new Date().toISOString().slice(0, 10) < readyOn)
    return { status: "waiting" as const, term, readyOn };
  const key = termKey(term);
  const count = async (range: typeof before) =>
    (await fetchSiteSearches(connection, range))
      .filter((row) => termKey(row.term) === key)
      .reduce((sum, row) => sum + row.searches, 0);
  const [searchesBefore, searchesAfter] = await Promise.all([
    count(before),
    count(after),
  ]);
  return {
    status: "measured" as const,
    term,
    before: { ...before, searches: searchesBefore },
    after: { ...after, searches: searchesAfter },
    ...searchResult(searchesBefore, searchesAfter),
  };
}

export const DocsResultService = { measure };
