import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, projects } from "@/db/schema";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { AuthRepository } from "@/server/auth/repositories/AuthRepository";
import { csvCell } from "@/server/features/experiments/experimentCsv";
import type { OpportunityContext } from "@/server/features/opportunities/services/opportunityAccess";
import type { ActivityFilters } from "@/types/schemas/activity";

// RFC-0009 5.6: Organization settings > Activity, for owners and admins.
const LIST_LIMIT = 200;
const EXPORT_LIMIT = 5000;

async function events(
  context: OpportunityContext,
  filters: ActivityFilters,
  limit: number,
) {
  requireOrgPermission(context, { integration: ["manage"] });
  const rows = await db
    .select({
      id: auditEvents.id,
      createdAt: auditEvents.createdAt,
      actorType: auditEvents.actorType,
      actorId: auditEvents.actorId,
      action: auditEvents.action,
      targetType: auditEvents.targetType,
      targetId: auditEvents.targetId,
      summary: auditEvents.summary,
      projectId: auditEvents.projectId,
      projectName: projects.name,
    })
    .from(auditEvents)
    .leftJoin(projects, eq(projects.id, auditEvents.projectId))
    .where(
      and(
        eq(auditEvents.organizationId, context.organizationId),
        filters.projectId
          ? eq(auditEvents.projectId, filters.projectId)
          : undefined,
        filters.action ? eq(auditEvents.action, filters.action) : undefined,
        filters.actorId ? eq(auditEvents.actorId, filters.actorId) : undefined,
      ),
    )
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(limit);
  const names = await AuthRepository.getHostedUserNames([
    ...new Set(rows.map((row) => row.actorId)),
  ]);
  return rows.map((row) => ({
    ...row,
    actorName: names.find((user) => user.id === row.actorId)?.name ?? null,
  }));
}

async function list(context: OpportunityContext, filters: ActivityFilters) {
  return events(context, filters, LIST_LIMIT);
}

async function exportCsv(
  context: OpportunityContext,
  filters: ActivityFilters,
) {
  const rows = await events(context, filters, EXPORT_LIMIT);
  const header = [
    "time",
    "actor",
    "actor_type",
    "action",
    "project",
    "summary",
  ];
  return [
    header.join(","),
    ...rows.map((row) =>
      [
        row.createdAt,
        row.actorName ?? row.actorId,
        row.actorType,
        row.action,
        row.projectName,
        row.summary,
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n");
}

/** Called by the daily retention job. */
export async function deleteAuditEventsBefore(cutoff: string) {
  const deleted = await db
    .delete(auditEvents)
    .where(lt(auditEvents.createdAt, cutoff))
    .returning({ id: auditEvents.id });
  return deleted.length;
}

export const ActivityService = { list, exportCsv };
