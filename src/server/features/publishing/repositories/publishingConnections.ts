import { and, eq, exists, getTableColumns, isNull } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { publishingConnections } from "@/db/schema";
import type { PublishingConnectionRecord } from "@/types/schemas/publishing";
import {
  auditInsert,
  type AuditInput,
} from "@/server/features/activity/auditLog";
import {
  claimExists,
  lockClaim,
  selectedValues,
  type ClaimScope,
} from "./publishingSql";

const { lastEventId: _lastEventId, ...connectionColumns } = getTableColumns(
  publishingConnections,
);

// RFC-0009: services pass the audit event; it lands only with the change.
// Repository tests may leave it out.
function connectionAudit(
  tx: Parameters<Parameters<typeof runBatch>[0]>[0],
  audit: AuditInput | undefined,
  projectId: string,
  lastEventId: string,
) {
  if (!audit) return [];
  return [
    auditInsert(
      tx,
      audit,
      exists(
        tx
          .select({ id: publishingConnections.id })
          .from(publishingConnections)
          .where(
            and(
              eq(publishingConnections.projectId, projectId),
              eq(publishingConnections.lastEventId, lastEventId),
            ),
          ),
      ),
    ),
  ];
}

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
  audit?: AuditInput;
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
    ...connectionAudit(tx, input.audit, connection.projectId, lastEventId),
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

export async function disconnect(
  input: ClaimScope & { audit?: AuditInput },
): Promise<boolean> {
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
    ...connectionAudit(tx, input.audit, input.projectId, lastEventId),
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

/**
 * RFC-0009 5.7: stores a token re-encrypted under the current key, only
 * when the row still holds the ciphertext that was opened.
 */
export async function rewrapToken(input: {
  projectId: string;
  connectionId: string;
  from: string;
  encryptedToken: string;
  tokenKeyVersion: number;
}) {
  await db
    .update(publishingConnections)
    .set({
      encryptedToken: input.encryptedToken,
      tokenKeyVersion: input.tokenKeyVersion,
    })
    .where(
      and(
        eq(publishingConnections.projectId, input.projectId),
        eq(publishingConnections.id, input.connectionId),
        eq(publishingConnections.encryptedToken, input.from),
        isNull(publishingConnections.revokedAt),
      ),
    );
}
