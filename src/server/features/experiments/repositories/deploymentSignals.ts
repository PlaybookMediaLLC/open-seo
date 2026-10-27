import { and, desc, eq, exists } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { experimentDeploymentSignals, growthExperiments } from "@/db/schema";
import type { DeploymentSignal } from "@/types/schemas/experiments";
import {
  claimExists,
  lockClaim,
  selectedValues,
} from "../../publishing/repositories/publishingSql";
import { experimentScope, type ExperimentScope } from "./experimentSql";

// One row per (experiment, kind, external id). A repeated check adds nothing.
export async function recordSignal(
  input: ExperimentScope & { signal: DeploymentSignal },
) {
  await runBatch((tx) => [
    lockClaim(tx, input),
    tx
      .insert(experimentDeploymentSignals)
      .select(
        selectedValues(
          experimentDeploymentSignals,
          input.signal,
          // oxlint-disable-next-line typescript/no-non-null-assertion -- and() is undefined only when every condition is, and claimExists() always returns SQL
          and(
            claimExists(tx, input),
            exists(
              tx
                .select({ id: growthExperiments.id })
                .from(growthExperiments)
                .where(experimentScope(input.projectId, input.experimentId)),
            ),
          )!,
        ),
      )
      .onConflictDoNothing(),
  ]);
}

export function listSignals(
  projectId: string,
  experimentId: string,
): Promise<DeploymentSignal[]> {
  return db
    .select()
    .from(experimentDeploymentSignals)
    .where(
      and(
        eq(experimentDeploymentSignals.projectId, projectId),
        eq(experimentDeploymentSignals.experimentId, experimentId),
      ),
    )
    .orderBy(desc(experimentDeploymentSignals.observedAt))
    .limit(50);
}
