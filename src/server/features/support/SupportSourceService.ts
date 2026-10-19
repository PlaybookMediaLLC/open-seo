import { count, eq, max } from "drizzle-orm";
import { db } from "@/db";
import {
  supportSources,
  supportTopicExcerpts,
  supportTopics,
} from "@/db/schema";
import { runBatch } from "@/db/runBatch";
import type { DraftContext } from "@/server/features/publishing/draftAdmission";
import { auditInsert } from "@/server/features/activity/auditLog";
import { ensureDefaultSchedules } from "@/server/features/growth/AutomationService";
import {
  authorizePublishing,
  type PublishingContext,
} from "@/server/features/publishing/publishingAccess";
import { processSupportTickets, supportTopicsEnabled } from "./supportSync";

// RFC-0017 5.4 and 6.2: GitHub Issues as a read-only support source. Every
// connection change writes an audit event; disconnecting deletes the topics.
async function status(context: PublishingContext, projectId: string) {
  await authorizePublishing(context, projectId);
  const [[source], [topics]] = await Promise.all([
    db
      .select({
        createdAt: supportSources.createdAt,
        lastProcessedAt: supportSources.lastProcessedAt,
      })
      .from(supportSources)
      .where(eq(supportSources.projectId, projectId)),
    db
      .select({ count: count(), tickets: max(supportTopics.ticketCount28d) })
      .from(supportTopics)
      .where(eq(supportTopics.projectId, projectId)),
  ]);
  return {
    enabled: await supportTopicsEnabled(),
    source: source ?? null,
    topics: topics?.count ?? 0,
  };
}

async function connect(context: PublishingContext, projectId: string) {
  await authorizePublishing(context, projectId, true);
  await runBatch((tx) => [
    tx
      .insert(supportSources)
      .values({
        id: crypto.randomUUID(),
        projectId,
        provider: "github_issues",
        createdBy: context.userId,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing(),
    auditInsert(tx, {
      organizationId: context.organizationId,
      projectId,
      actor: context,
      action: "integration.support_connected",
      targetType: "project",
      targetId: projectId,
      summary: "Connected GitHub Issues as a read-only support source",
    }),
  ]);
  await ensureDefaultSchedules(projectId, context.userId, ["support_topics"]);
  return { ok: true };
}

async function disconnect(context: PublishingContext, projectId: string) {
  await authorizePublishing(context, projectId, true);
  await runBatch((tx) => [
    tx
      .delete(supportTopicExcerpts)
      .where(eq(supportTopicExcerpts.projectId, projectId)),
    tx.delete(supportTopics).where(eq(supportTopics.projectId, projectId)),
    tx.delete(supportSources).where(eq(supportSources.projectId, projectId)),
    auditInsert(tx, {
      organizationId: context.organizationId,
      projectId,
      actor: context,
      action: "integration.support_disconnected",
      targetType: "project",
      targetId: projectId,
      summary: "Disconnected GitHub Issues and deleted the support topics",
    }),
  ]);
  return { ok: true };
}

async function processNow(context: DraftContext, projectId: string) {
  await authorizePublishing(context, projectId, true);
  return processSupportTickets(projectId, new Date(), {
    organizationId: context.organizationId,
    userId: context.userId,
    userEmail: context.userEmail,
    projectId,
  });
}

export const SupportSourceService = { status, connect, disconnect, processNow };
