import { and, eq, exists, getTableColumns, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  growthExperiments,
  measurementRuns,
  gscConnections,
} from "@/db/schema";
import {
  claimExists,
  type ClaimScope,
  type Executor,
} from "../../publishing/repositories/publishingSql";

export type ExperimentScope = ClaimScope & { experimentId: string };
const { lastEventId: _lastEventId, ...experimentColumns } =
  getTableColumns(growthExperiments);
const {
  claimToken: _claimToken,
  completionToken: _completionToken,
  ...runColumns
} = getTableColumns(measurementRuns);
export { experimentColumns, runColumns };

export function experimentScope(projectId: string, experimentId: string) {
  return and(
    eq(growthExperiments.projectId, projectId),
    eq(growthExperiments.id, experimentId),
  );
}

export function currentProperty(tx: Executor, projectId: string) {
  return exists(
    tx
      .select({ id: gscConnections.id })
      .from(gscConnections)
      .where(
        and(
          eq(gscConnections.projectId, projectId),
          eq(gscConnections.siteUrl, growthExperiments.siteUrl),
        ),
      ),
  );
}

export function lockProperty(tx: Executor, input: ExperimentScope) {
  return tx
    .update(gscConnections)
    .set({ siteUrl: sql`${gscConnections.siteUrl}` })
    .where(
      and(
        eq(gscConnections.projectId, input.projectId),
        claimExists(tx, input),
        exists(
          tx
            .select({ id: growthExperiments.id })
            .from(growthExperiments)
            .where(
              and(
                experimentScope(input.projectId, input.experimentId),
                eq(growthExperiments.siteUrl, gscConnections.siteUrl),
              ),
            ),
        ),
      ),
    );
}

export async function experimentAccepted(
  projectId: string,
  experimentId: string,
  eventId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: growthExperiments.id })
    .from(growthExperiments)
    .where(
      and(
        experimentScope(projectId, experimentId),
        eq(growthExperiments.lastEventId, eventId),
      ),
    );
  return Boolean(row);
}
