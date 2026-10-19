import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { revenueConnections, revenueEvents } from "@/db/schema";
import { auditInsert } from "@/server/features/activity/auditLog";
import {
  authorizePublishing,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";
import { encryptToken } from "@/server/features/publishing/tokenKeys";
import { sha256Hex } from "@/server/lib/audit/ids";
import { AppError } from "@/server/lib/errors";
import { probeWriteAccess, stripeGet } from "@/server/lib/stripe";

// RFC-0016 5.3: a read-only Stripe connection. Only restricted keys with no
// write access are accepted, and disconnecting deletes the key and every
// revenue row of the project.
const RESTRICTED = /^rk_(live|test)_[A-Za-z0-9]{10,}$/;

async function status(context: PublishingContext, projectId: string) {
  await authorizePublishing(context, projectId);
  const [connection] = await db
    .select({
      livemode: revenueConnections.livemode,
      createdAt: revenueConnections.createdAt,
      lastSyncedAt: revenueConnections.lastSyncedAt,
    })
    .from(revenueConnections)
    .where(eq(revenueConnections.projectId, projectId));
  return connection ?? null;
}

async function connect(
  context: PublishingContext,
  input: { projectId: string; key: string },
) {
  await authorizePublishing(context, input.projectId, true);
  const key = input.key.trim();
  if (key.startsWith("sk_"))
    throw new AppError(
      "VALIDATION_ERROR",
      "Relay does not accept secret keys. Create a restricted key with read access only.",
    );
  if (!RESTRICTED.test(key))
    throw new AppError(
      "VALIDATION_ERROR",
      "Enter a Stripe restricted key, which starts with rk_live_ or rk_test_.",
    );
  try {
    await stripeGet(
      key,
      "/invoices",
      z.object({ data: z.array(z.unknown()) }),
      {
        limit: "1",
      },
    );
  } catch {
    throw new AppError(
      "VALIDATION_ERROR",
      "The key cannot read invoices. Give it read access to Invoices, Subscriptions, Checkout Sessions and Customers.",
    );
  }
  const probe = await probeWriteAccess(key);
  if (!probe.readOnly)
    throw new AppError(
      "VALIDATION_ERROR",
      "The key can write to Stripe. Relay accepts read-only keys only.",
    );
  const { encryptedToken, tokenKeyVersion } = await encryptToken(key);
  const hashSalt = crypto.randomUUID();
  const now = new Date().toISOString();
  const values = {
    provider: "stripe" as const,
    encryptedKey: encryptedToken,
    keyVersion: tokenKeyVersion,
    hashSalt,
    accountIdHash: probe.accountId
      ? await sha256Hex(`${hashSalt}:${probe.accountId}`)
      : null,
    livemode: key.startsWith("rk_live_"),
    syncCursor: null,
    createdBy: context.userId,
    createdAt: now,
    lastSyncedAt: null,
  };
  // A new key starts over: rows hashed with the old salt cannot be matched.
  await runBatch((tx) => [
    tx
      .delete(revenueEvents)
      .where(eq(revenueEvents.projectId, input.projectId)),
    tx
      .delete(revenueConnections)
      .where(eq(revenueConnections.projectId, input.projectId)),
    tx.insert(revenueConnections).values({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      ...values,
    }),
    auditInsert(tx, {
      organizationId: context.organizationId,
      projectId: input.projectId,
      actor: context,
      action: "integration.stripe_connected",
      targetType: "project",
      targetId: input.projectId,
      summary: `Connected Stripe (${values.livemode ? "live" : "test"} mode) with a read-only key`,
    }),
  ]);
  return { ok: true, livemode: values.livemode };
}

async function disconnect(context: PublishingContext, projectId: string) {
  await authorizePublishing(context, projectId, true);
  await runBatch((tx) => [
    tx.delete(revenueEvents).where(eq(revenueEvents.projectId, projectId)),
    tx
      .delete(revenueConnections)
      .where(eq(revenueConnections.projectId, projectId)),
    auditInsert(tx, {
      organizationId: context.organizationId,
      projectId,
      actor: context,
      action: "integration.stripe_disconnected",
      targetType: "project",
      targetId: projectId,
      summary: "Disconnected Stripe and deleted the revenue data",
    }),
  ]);
  return { ok: true };
}

export const RevenueConnectionService = { status, connect, disconnect };
