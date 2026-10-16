import { and, eq, getTableColumns, isNull } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { publishingConnections } from "@/db/schema";
import type { PublishingConnectionRecord } from "@/types/schemas/publishing";
import {
  claimExists,
  lockClaim,
  selectedValues,
  type ClaimScope,
} from "./publishingSql";

const { lastEventId: _lastEventId, ...connectionColumns } = getTableColumns(
  publishingConnections,
);

export async function getConnection(
  projectId: string,
): Promise<PublishingConnectionRecord | null> {
  const [row] = await db
    .select(connectionColumns)
    .from(publishingConnections)
    .where(
      and(
        eq(publishingConnections.projectId, projectId),
        isNull(publishingConnections.revokedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getConnectionById(
  projectId: string,
  id: string,
): Promise<PublishingConnectionRecord | null> {
  const [row] = await db
    .select(connectionColumns)
    .from(publishingConnections)
    .where(
      and(
        eq(publishingConnections.projectId, projectId),
        eq(publishingConnections.id, id),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function replaceConnection(input: {
  connection: PublishingConnectionRecord;
  claimToken: string;
  organizationId: string;
}): Promise<boolean> {
  const { connection } = input;
  if (
    connection.revokedAt !== null ||
    (connection.transport === "pat"
      ? !connection.encryptedToken
      : !connection.installationRef || connection.encryptedToken !== null)
  )
    return false;
  const scope = { ...input, projectId: connection.projectId };
  const lastEventId = crypto.randomUUID();
  await runBatch((tx) => [
    lockClaim(tx, scope),
    tx
      .update(publishingConnections)
      .set({
        revokedAt: new Date().toISOString(),
        encryptedToken: null,
        lastEventId,
      })
      .where(
        and(
          eq(publishingConnections.projectId, connection.projectId),
          isNull(publishingConnections.revokedAt),
          claimExists(tx, scope),
        ),
      ),
    tx
      .insert(publishingConnections)
      .select(
        selectedValues(
          publishingConnections,
          { ...connection, lastEventId },
          claimExists(tx, scope),
        ),
      ),
  ]);
  const [accepted] = await db
    .select({ id: publishingConnections.id })
    .from(publishingConnections)
    .where(
      and(
        eq(publishingConnections.projectId, connection.projectId),
        eq(publishingConnections.id, connection.id),
        eq(publishingConnections.lastEventId, lastEventId),
      ),
    );
  return Boolean(accepted);
}

export async function disconnect(input: ClaimScope): Promise<boolean> {
  const lastEventId = crypto.randomUUID();
  await runBatch((tx) => [
    lockClaim(tx, input),
    tx
      .update(publishingConnections)
      .set({
        revokedAt: new Date().toISOString(),
        encryptedToken: null,
        lastEventId,
      })
      .where(
        and(
          eq(publishingConnections.projectId, input.projectId),
          isNull(publishingConnections.revokedAt),
          claimExists(tx, input),
        ),
      ),
  ]);
  const [accepted] = await db
    .select({ id: publishingConnections.id })
    .from(publishingConnections)
    .where(
      and(
        eq(publishingConnections.projectId, input.projectId),
        eq(publishingConnections.lastEventId, lastEventId),
      ),
    );
  return Boolean(accepted);
}

// The GitHub environment name that counts as production for deployment
// signals. It changes no access, so it updates the active connection in place.
export async function setProductionEnvironment(
  input: ClaimScope & { productionEnvironment: string },
): Promise<boolean> {
  const lastEventId = crypto.randomUUID();
  await runBatch((tx) => [
    lockClaim(tx, input),
    tx
      .update(publishingConnections)
      .set({ productionEnvironment: input.productionEnvironment, lastEventId })
      .where(
        and(
          eq(publishingConnections.projectId, input.projectId),
          isNull(publishingConnections.revokedAt),
          claimExists(tx, input),
        ),
      ),
  ]);
  const [accepted] = await db
    .select({ id: publishingConnections.id })
    .from(publishingConnections)
    .where(
      and(
        eq(publishingConnections.projectId, input.projectId),
        eq(publishingConnections.lastEventId, lastEventId),
      ),
    );
  return Boolean(accepted);
}
