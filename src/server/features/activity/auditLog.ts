import type { SQL } from "drizzle-orm";
import { db } from "@/db";
import type { AUDIT_ACTIONS } from "@/shared/auditActions";
import { auditEvents } from "@/db/schema";
import {
  selectedValues,
  type Executor,
} from "@/server/features/publishing/repositories/publishingSql";

// RFC-0009 5.6: audit events. Fork code writes the event inside the
// change's own batch; upstream paths record it after the change succeeds.
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** MCP contexts carry a client id; scheduled jobs mark themselves. */
export type AuditActor = {
  userId: string;
  clientId?: string | null;
  scheduled?: boolean;
};

export type AuditInput = {
  organizationId: string;
  projectId: string | null;
  actor: AuditActor;
  action: AuditAction;
  targetType: string;
  targetId: string;
  summary: string;
};

function auditRow(input: AuditInput) {
  return {
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    projectId: input.projectId,
    actorType: input.actor.scheduled
      ? ("system" as const)
      : input.actor.clientId
        ? ("mcp" as const)
        : ("user" as const),
    actorId: input.actor.userId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    summary: input.summary.slice(0, 300),
    createdAt: new Date().toISOString(),
  };
}

/**
 * The event as one statement of the change's batch. With a condition, it
 * lands only when the change did, so a refused change writes no event.
 */
export function auditInsert(tx: Executor, input: AuditInput, condition?: SQL) {
  const row = auditRow(input);
  return condition
    ? tx.insert(auditEvents).select(selectedValues(auditEvents, row, condition))
    : tx.insert(auditEvents).values(row);
}

/** For upstream paths, after the change succeeded. A failure only logs. */
export async function recordAudit(input: AuditInput) {
  try {
    await db.insert(auditEvents).values(auditRow(input));
  } catch (error) {
    console.error("[audit] event write failed", {
      action: input.action,
      error: error instanceof Error ? error.name : "unknown",
    });
  }
}

const SUMMARIES: Partial<Record<AuditAction, string>> = {
  "integration.gsc_connected": "Connected Search Console",
  "integration.gsc_disconnected": "Disconnected Search Console",
  "integration.ga4_connected": "Connected Google Analytics",
  "integration.ga4_disconnected": "Disconnected Google Analytics",
  "member.invited": "Invited a member",
};

/** One seam line in an upstream server function, after its change. */
export function auditAfter(
  context: AuditActor & { organizationId: string; projectId?: string },
  action: AuditAction,
) {
  return recordAudit({
    organizationId: context.organizationId,
    projectId: context.projectId ?? null,
    actor: context,
    action,
    targetType: context.projectId ? "project" : "organization",
    targetId: context.projectId ?? context.organizationId,
    summary: SUMMARIES[action] ?? action,
  });
}
