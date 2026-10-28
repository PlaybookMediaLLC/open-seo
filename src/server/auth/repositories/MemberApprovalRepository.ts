import { and, eq, exists, sql } from "drizzle-orm";
import { runBatch } from "@/db/runBatch";
import { member } from "@/db/schema";
import {
  auditInsert,
  type AuditInput,
} from "@/server/features/activity/auditLog";

/**
 * RFC-0007 6.4: a compare-and-set of one member's role, with its audit event.
 * A role that changed since the caller read it makes the batch a no-op, and
 * the event lands only when the role was still `from`.
 */
async function setRole(input: {
  organizationId: string;
  memberId: string;
  from: string;
  to: string;
  audit: AuditInput;
}): Promise<void> {
  const target = and(
    eq(member.id, input.memberId),
    eq(member.organizationId, input.organizationId),
  );
  const unchanged = and(target, eq(member.role, input.from));
  await runBatch((tx) => [
    // Row-lock first, as transferOwnership does: a concurrent change on
    // Postgres waits here, then sees the new role and writes no second event.
    tx
      .update(member)
      .set({ role: sql`${member.role}` })
      .where(target),
    auditInsert(
      tx,
      input.audit,
      exists(tx.select({ id: member.id }).from(member).where(unchanged)),
    ),
    tx.update(member).set({ role: input.to }).where(unchanged),
  ]);
}

export const MemberApprovalRepository = { setRole } as const;
