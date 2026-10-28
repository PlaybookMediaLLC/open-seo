import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { member, projectPublishingApprovers, user } from "@/db/schema";
import {
  auditInsert,
  type AuditInput,
} from "@/server/features/activity/auditLog";

// RFC-0007 6.5: the members a project lists as its approvers. Every read joins
// the member row of the project's organization.

/** User ids of the project's listed approvers. */
export async function listApproverUserIds(
  projectId: string,
  organizationId: string,
): Promise<string[]> {
  const rows = await db
    .select({ userId: member.userId })
    .from(projectPublishingApprovers)
    .innerJoin(member, eq(member.id, projectPublishingApprovers.memberId))
    .where(
      and(
        eq(projectPublishingApprovers.projectId, projectId),
        eq(member.organizationId, organizationId),
      ),
    );
  return rows.map((row) => row.userId);
}

/** The organization's members, with whether the project lists each one. */
export async function listApproverCandidates(
  projectId: string,
  organizationId: string,
) {
  const [members, listed] = await Promise.all([
    db
      .select({
        memberId: member.id,
        userId: member.userId,
        role: member.role,
        name: user.name,
        email: user.email,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, organizationId))
      .orderBy(asc(member.createdAt)),
    db
      .select({ memberId: projectPublishingApprovers.memberId })
      .from(projectPublishingApprovers)
      .where(eq(projectPublishingApprovers.projectId, projectId)),
  ]);
  const listedIds = new Set(listed.map((row) => row.memberId));
  return members.map((row) => ({
    ...row,
    listed: listedIds.has(row.memberId),
  }));
}

/** Member rows of this organization among the given ids. */
export async function membersIn(
  organizationId: string,
  memberIds: readonly string[],
) {
  if (!memberIds.length) return [];
  return db
    .select({ memberId: member.id, role: member.role })
    .from(member)
    .where(
      and(
        eq(member.organizationId, organizationId),
        inArray(member.id, [...memberIds]),
      ),
    );
}

/** Replaces the project's list, with its audit event, in one batch. */
export async function replaceApprovers(input: {
  projectId: string;
  memberIds: readonly string[];
  grantedByUserId: string;
  audit: AuditInput;
}): Promise<void> {
  const createdAt = new Date().toISOString();
  await runBatch((tx) => [
    auditInsert(tx, input.audit),
    tx
      .delete(projectPublishingApprovers)
      .where(eq(projectPublishingApprovers.projectId, input.projectId)),
    ...(input.memberIds.length
      ? [
          tx.insert(projectPublishingApprovers).values(
            input.memberIds.map((memberId) => ({
              projectId: input.projectId,
              memberId,
              grantedByUserId: input.grantedByUserId,
              createdAt,
            })),
          ),
        ]
      : []),
  ]);
}
