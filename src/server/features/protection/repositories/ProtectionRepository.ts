import { and, asc, eq, exists, inArray, isNull, type SQL } from "drizzle-orm";
import { chunk } from "remeda";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  auditEvents,
  monitoredPages,
  protectionEnrollments,
  protectionScopeChanges,
  user,
} from "@/db/schema";
import {
  auditInsert,
  type AuditInput,
} from "@/server/features/activity/auditLog";
import type { MONITORED_PAGE_REASONS } from "@/shared/protection";

// RFC-0026 phase A (IRFC-0001): a project's protected-site record. Every read
// is keyed by the verified project; every change writes its audit event in
// the same batch.
export type ProtectionEnrollment = typeof protectionEnrollments.$inferSelect;
type EnrollmentChanges = Partial<
  Omit<
    typeof protectionEnrollments.$inferInsert,
    | "id"
    | "projectId"
    | "scopeVersion"
    | "createdBy"
    | "createdAt"
    | "updatedBy"
    | "updatedAt"
  >
>;

// Eight rows of eleven columns stay inside D1's 100 bound parameters.
const PAGES_PER_INSERT = 8;

async function getEnrollment(
  projectId: string,
): Promise<ProtectionEnrollment | null> {
  const [row] = await db
    .select()
    .from(protectionEnrollments)
    .where(eq(protectionEnrollments.projectId, projectId))
    .limit(1);
  return row ?? null;
}

/** The current page set, excluded pages included. */
async function listPages(enrollmentId: string) {
  return db
    .select({
      id: monitoredPages.id,
      path: monitoredPages.path,
      selectionReason: monitoredPages.selectionReason,
      excludedReason: monitoredPages.excludedReason,
      addedAt: monitoredPages.addedAt,
    })
    .from(monitoredPages)
    .where(
      and(
        eq(monitoredPages.enrollmentId, enrollmentId),
        isNull(monitoredPages.removedAt),
      ),
    )
    .orderBy(asc(monitoredPages.addedAt), asc(monitoredPages.path));
}

/** Account rows, for modes that have no member rows. */
async function usersByIds(userIds: readonly string[]) {
  if (!userIds.length) return [];
  return db
    .select({ userId: user.id, name: user.name, email: user.email })
    .from(user)
    .where(inArray(user.id, [...userIds]));
}

/** The enrollment at scope version 1. A second create fails on project_id. */
async function createEnrollment(input: {
  enrollment: typeof protectionEnrollments.$inferInsert & { id: string };
  audit: AuditInput;
}): Promise<void> {
  const { enrollment } = input;
  await runBatch((tx) => [
    tx.insert(protectionEnrollments).values(enrollment),
    tx.insert(protectionScopeChanges).values({
      enrollmentId: enrollment.id,
      scopeVersion: 1,
      changedBy: enrollment.createdBy,
      changedAt: enrollment.createdAt,
    }),
    auditInsert(tx, input.audit),
  ]);
}

/**
 * One change to the enrollment, applied only where `where` still holds, and
 * its event, which lands only with the change. A change that bumps the scope
 * inserts `scopeVersion` first: a second change from the same version
 * collides there and its whole batch rolls back, so scope changes pass no
 * `where`. Returns whether the change landed, read from its event: later
 * writes can replace the enrollment's fields, but never the event.
 */
async function updateEnrollment(input: {
  enrollmentId: string;
  userId: string;
  set: EnrollmentChanges;
  where?: SQL;
  scopeVersion?: number;
  audit: AuditInput;
}): Promise<boolean> {
  const updatedAt = new Date().toISOString();
  const eventId = crypto.randomUUID();
  await runBatch((tx) => [
    ...(input.scopeVersion
      ? [
          tx.insert(protectionScopeChanges).values({
            enrollmentId: input.enrollmentId,
            scopeVersion: input.scopeVersion,
            changedBy: input.userId,
            changedAt: updatedAt,
          }),
        ]
      : []),
    tx
      .update(protectionEnrollments)
      .set({
        ...input.set,
        ...(input.scopeVersion ? { scopeVersion: input.scopeVersion } : {}),
        updatedBy: input.userId,
        updatedAt,
      })
      .where(
        and(eq(protectionEnrollments.id, input.enrollmentId), input.where),
      ),
    auditInsert(
      tx,
      { ...input.audit, id: eventId },
      exists(
        tx
          .select({ id: protectionEnrollments.id })
          .from(protectionEnrollments)
          .where(
            and(
              eq(protectionEnrollments.id, input.enrollmentId),
              eq(protectionEnrollments.updatedAt, updatedAt),
              eq(protectionEnrollments.updatedBy, input.userId),
            ),
          ),
      ),
    ),
  ]);
  const [event] = await db
    .select({ id: auditEvents.id })
    .from(auditEvents)
    .where(eq(auditEvents.id, eventId));
  return Boolean(event);
}

/** A test alert went to this reviewer; no event, as it changes no scope. */
async function markAlertTested(
  enrollmentId: string,
  reviewerUserId: string,
): Promise<void> {
  await db
    .update(protectionEnrollments)
    .set({ alertTestedAt: new Date().toISOString() })
    .where(
      and(
        eq(protectionEnrollments.id, enrollmentId),
        eq(protectionEnrollments.reviewerUserId, reviewerUserId),
      ),
    );
}

/**
 * Changes the page set behind the scope fence: the next version's insert
 * comes first, so a save from a stale version writes nothing at all.
 */
async function savePages(input: {
  enrollmentId: string;
  projectId: string;
  scopeVersion: number;
  userId: string;
  add: ReadonlyArray<{
    path: string;
    selectionReason: (typeof MONITORED_PAGE_REASONS)[number];
  }>;
  remove: readonly string[];
  exclude: ReadonlyArray<{ pageId: string; reason: string }>;
  include: readonly string[];
  audit: AuditInput;
}): Promise<void> {
  const now = new Date().toISOString();
  const current = (pageIds: readonly string[]) =>
    and(
      eq(monitoredPages.enrollmentId, input.enrollmentId),
      inArray(monitoredPages.id, [...pageIds]),
      isNull(monitoredPages.removedAt),
    );
  await runBatch((tx) => [
    tx.insert(protectionScopeChanges).values({
      enrollmentId: input.enrollmentId,
      scopeVersion: input.scopeVersion,
      changedBy: input.userId,
      changedAt: now,
    }),
    tx
      .update(protectionEnrollments)
      .set({
        scopeVersion: input.scopeVersion,
        updatedBy: input.userId,
        updatedAt: now,
      })
      .where(eq(protectionEnrollments.id, input.enrollmentId)),
    ...(input.remove.length
      ? [
          tx
            .update(monitoredPages)
            .set({ removedBy: input.userId, removedAt: now })
            .where(current(input.remove)),
        ]
      : []),
    ...input.exclude.map((page) =>
      tx
        .update(monitoredPages)
        .set({ excludedReason: page.reason })
        .where(current([page.pageId])),
    ),
    ...(input.include.length
      ? [
          tx
            .update(monitoredPages)
            .set({ excludedReason: null })
            .where(current(input.include)),
        ]
      : []),
    ...chunk(input.add, PAGES_PER_INSERT).map((rows) =>
      tx.insert(monitoredPages).values(
        rows.map((row) => ({
          id: crypto.randomUUID(),
          projectId: input.projectId,
          enrollmentId: input.enrollmentId,
          path: row.path,
          selectionReason: row.selectionReason,
          scopeVersion: input.scopeVersion,
          addedBy: input.userId,
          addedAt: now,
        })),
      ),
    ),
    auditInsert(tx, input.audit),
  ]);
}

export const ProtectionRepository = {
  getEnrollment,
  listPages,
  usersByIds,
  createEnrollment,
  updateEnrollment,
  markAlertTested,
  savePages,
};
