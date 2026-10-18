import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import type { OpportunityTicket } from "@/types/schemas/publishing";
import { PublishingRepository as repo } from "./PublishingRepository";
import { fixture } from "./publishingTestFixtures";

const database = await vi.hoisted(async () => {
  const { createPublishingTestDatabase } = await import("./publishingTestDb");
  return createPublishingTestDatabase();
});
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
beforeAll(() => database.prepare());
afterAll(() => database.close());

it("keeps one ticket per approved text, and records one issue for it", async () => {
  const input = await fixture(database);
  const ticket = (id: string): OpportunityTicket => ({
    id,
    projectId: input.projectId,
    opportunityId: input.proposal.opportunityId,
    connectionId: input.connection.id,
    textHash: "a".repeat(64),
    issueNumber: null,
    issueUrl: null,
    createdBy: "reviewer",
    createdAt: new Date().toISOString(),
  });
  const audit = {
    organizationId: input.organizationId,
    projectId: input.projectId,
    actor: { userId: "reviewer" },
    action: "ticket.created",
    targetType: "opportunity",
    targetId: input.proposal.opportunityId,
    summary: "Created a GitHub issue",
  } as const;
  const claim = (id: string) =>
    repo.claimTicket({ ...input, audit, ticket: ticket(id) });
  expect((await claim("t-1"))?.id).toBe("t-1");
  expect((await claim("t-2"))?.id).toBe("t-1");
  // RFC-0009: the repeat returned the first ticket and wrote no event.
  expect(
    await db
      .select({ action: auditEvents.action })
      .from(auditEvents)
      .where(eq(auditEvents.projectId, input.projectId)),
  ).toEqual([{ action: "ticket.created" }]);
  const issue = (issueNumber: number) =>
    repo.completeTicket({
      ...input,
      id: "t-1",
      issueNumber,
      issueUrl: `https://github.com/owner/site/issues/${issueNumber}`,
    });
  expect(await issue(7)).toBe(true);
  expect(await issue(8)).toBe(false);
});
