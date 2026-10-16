import { afterAll, beforeAll, expect, it, vi } from "vitest";
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
  const first = await repo.claimTicket({ ...input, ticket: ticket("t-1") });
  const second = await repo.claimTicket({ ...input, ticket: ticket("t-2") });
  expect(first?.id).toBe("t-1");
  expect(second?.id).toBe("t-1");
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
