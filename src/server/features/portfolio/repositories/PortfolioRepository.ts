import {
  aliasedTable,
  and,
  count,
  eq,
  exists,
  isNotNull,
  isNull,
  notInArray,
  or,
} from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  agencyClientLinks,
  opportunities,
  organization,
  projects,
} from "@/db/schema";
import {
  auditInsert,
  type AuditInput,
} from "@/server/features/activity/auditLog";
import type { OpportunityStatus } from "@/types/schemas/opportunities";

// RFC-0007 6.1: an opportunity in one of these needs no more work.
const CLOSED_STATUSES = [
  "completed",
  "rejected",
  "reverted",
] satisfies OpportunityStatus[];

/** Open opportunities of the organization's active projects, grouped. */
async function openOpportunityCounts(organizationId: string) {
  return db
    .select({
      projectId: opportunities.projectId,
      type: opportunities.type,
      status: opportunities.status,
      total: count(),
    })
    .from(opportunities)
    .innerJoin(projects, eq(projects.id, opportunities.projectId))
    .where(
      and(
        eq(projects.organizationId, organizationId),
        isNull(projects.archivedAt),
        notInArray(opportunities.status, CLOSED_STATUSES),
      ),
    )
    .groupBy(opportunities.projectId, opportunities.type, opportunities.status);
}

// RFC-0007 6.6: agency links. Every read and write names the organization
// the caller is in, as the agency or as the client.
const agency = aliasedTable(organization, "agency");
const client = aliasedTable(organization, "client");

/** The organization's open links, as the agency or as the client. */
async function listOpenLinks(organizationId: string) {
  return db
    .select({
      id: agencyClientLinks.id,
      agencyOrganizationId: agencyClientLinks.agencyOrganizationId,
      agencyName: agency.name,
      clientOrganizationId: agencyClientLinks.clientOrganizationId,
      clientName: client.name,
      requestedAt: agencyClientLinks.requestedAt,
      acceptedAt: agencyClientLinks.acceptedAt,
    })
    .from(agencyClientLinks)
    .innerJoin(agency, eq(agency.id, agencyClientLinks.agencyOrganizationId))
    .innerJoin(client, eq(client.id, agencyClientLinks.clientOrganizationId))
    .where(
      and(
        isNull(agencyClientLinks.endedAt),
        or(
          eq(agencyClientLinks.agencyOrganizationId, organizationId),
          eq(agencyClientLinks.clientOrganizationId, organizationId),
        ),
      ),
    )
    .orderBy(agencyClientLinks.requestedAt);
}

/** Clients that accepted this organization as their agency. */
async function activeClients(agencyOrganizationId: string) {
  return db
    .select({
      linkId: agencyClientLinks.id,
      organizationId: agencyClientLinks.clientOrganizationId,
      organizationName: client.name,
    })
    .from(agencyClientLinks)
    .innerJoin(client, eq(client.id, agencyClientLinks.clientOrganizationId))
    .where(
      and(
        eq(agencyClientLinks.agencyOrganizationId, agencyOrganizationId),
        isNotNull(agencyClientLinks.acceptedAt),
        isNull(agencyClientLinks.endedAt),
      ),
    )
    .orderBy(client.name);
}

async function getOpenLink(linkId: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(agencyClientLinks)
    .where(
      and(
        eq(agencyClientLinks.id, linkId),
        isNull(agencyClientLinks.endedAt),
        or(
          eq(agencyClientLinks.agencyOrganizationId, organizationId),
          eq(agencyClientLinks.clientOrganizationId, organizationId),
        ),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * A new pending link. One open link per pair: a second request is a no-op,
 * and its events land only with the row.
 */
async function requestLink(input: {
  id: string;
  agencyOrganizationId: string;
  clientOrganizationId: string;
  userId: string;
  audits: readonly AuditInput[];
}): Promise<boolean> {
  const requestedAt = new Date().toISOString();
  await runBatch((tx) => {
    const created = exists(
      tx
        .select({ id: agencyClientLinks.id })
        .from(agencyClientLinks)
        .where(eq(agencyClientLinks.id, input.id)),
    );
    return [
      tx
        .insert(agencyClientLinks)
        .values({
          id: input.id,
          agencyOrganizationId: input.agencyOrganizationId,
          clientOrganizationId: input.clientOrganizationId,
          requestedByUserId: input.userId,
          requestedAt,
        })
        .onConflictDoNothing(),
      ...input.audits.map((audit) => auditInsert(tx, audit, created)),
    ];
  });
  return Boolean(await getOpenLink(input.id, input.agencyOrganizationId));
}

/** The client's owner accepts a pending link. */
async function acceptLink(input: {
  linkId: string;
  clientOrganizationId: string;
  userId: string;
  audits: readonly AuditInput[];
}): Promise<boolean> {
  const acceptedAt = new Date().toISOString();
  const accepted = and(
    eq(agencyClientLinks.id, input.linkId),
    eq(agencyClientLinks.acceptedAt, acceptedAt),
    eq(agencyClientLinks.acceptedByUserId, input.userId),
  );
  await runBatch((tx) => [
    tx
      .update(agencyClientLinks)
      .set({ acceptedAt, acceptedByUserId: input.userId })
      .where(
        and(
          eq(agencyClientLinks.id, input.linkId),
          eq(
            agencyClientLinks.clientOrganizationId,
            input.clientOrganizationId,
          ),
          isNull(agencyClientLinks.acceptedAt),
          isNull(agencyClientLinks.endedAt),
        ),
      ),
    ...input.audits.map((audit) =>
      auditInsert(
        tx,
        audit,
        exists(
          tx
            .select({ id: agencyClientLinks.id })
            .from(agencyClientLinks)
            .where(accepted),
        ),
      ),
    ),
  ]);
  const [row] = await db
    .select({ id: agencyClientLinks.id })
    .from(agencyClientLinks)
    .where(accepted);
  return Boolean(row);
}

/** Either owner declines, withdraws or ends an open link. */
async function endLink(input: {
  linkId: string;
  organizationId: string;
  userId: string;
  audits: readonly AuditInput[];
}): Promise<boolean> {
  const endedAt = new Date().toISOString();
  const ended = and(
    eq(agencyClientLinks.id, input.linkId),
    eq(agencyClientLinks.endedAt, endedAt),
    eq(agencyClientLinks.endedByUserId, input.userId),
  );
  await runBatch((tx) => [
    tx
      .update(agencyClientLinks)
      .set({ endedAt, endedByUserId: input.userId })
      .where(
        and(
          eq(agencyClientLinks.id, input.linkId),
          isNull(agencyClientLinks.endedAt),
          or(
            eq(agencyClientLinks.agencyOrganizationId, input.organizationId),
            eq(agencyClientLinks.clientOrganizationId, input.organizationId),
          ),
        ),
      ),
    ...input.audits.map((audit) =>
      auditInsert(
        tx,
        audit,
        exists(
          tx
            .select({ id: agencyClientLinks.id })
            .from(agencyClientLinks)
            .where(ended),
        ),
      ),
    ),
  ]);
  const [row] = await db
    .select({ id: agencyClientLinks.id })
    .from(agencyClientLinks)
    .where(ended);
  return Boolean(row);
}

export const PortfolioRepository = {
  openOpportunityCounts,
  listOpenLinks,
  activeClients,
  getOpenLink,
  requestLink,
  acceptLink,
  endLink,
} as const;
