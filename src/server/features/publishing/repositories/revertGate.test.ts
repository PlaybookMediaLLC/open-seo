import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PublishingRepository as repo } from "./PublishingRepository";
import { attempt, fixture, nextClaim } from "./publishingTestFixtures";

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
const { client } = database;

type Input = Awaited<ReturnType<typeof fixture>>;
const progress = (input: Input) => ({
  projectId: input.projectId,
  executionId: input.claimToken,
  organizationId: input.organizationId,
  requestCount: 3,
  message: "Checkpoint",
});
async function opportunity(input: Input) {
  return (
    await client.execute({
      sql: "SELECT status, version FROM opportunities WHERE id = ?",
      args: [input.proposal.opportunityId],
    })
  ).rows[0];
}
async function shipped(input: Input) {
  expect(await repo.beginExecution(attempt(input))).toBe(true);
  expect(
    await repo.checkpoint({
      ...progress(input),
      phase: "pull_request_created",
      commitSha: "commit",
      pullRequestNumber: 42,
      pullRequestUrl: "https://github.com/owner/site/pull/42",
    }),
  ).toBe(true);
}
// The inverse proposal, prepared against the opportunity as it is now.
async function revertOf(input: Input) {
  const next = await nextClaim(input);
  const { version } = await opportunity(input);
  return {
    ...next,
    proposal: {
      ...input.proposal,
      id: crypto.randomUUID(),
      revertsProposalId: input.proposal.id,
      fingerprintVersion: 3,
      opportunityVersion: Number(version),
      descriptionBefore: input.proposal.descriptionAfter,
      descriptionAfter: input.proposal.descriptionBefore,
    },
  };
}

describe(`Revert gate real ${database.isPostgres ? "Postgres" : "SQLite"}`, () => {
  it("refuses a revert of a change without a pull request", async () => {
    const input = await fixture(database);
    expect(await repo.saveProposal(input)).toBe(true);
    expect(await repo.saveProposal(await revertOf(input))).toBe(false);
  });

  it("runs a revert after the original pull request and keeps the status, also on failure", async () => {
    const input = await fixture(database);
    expect(await repo.saveProposal(input)).toBe(true);
    await shipped(input);
    const revert = await revertOf(input);
    expect(await repo.saveProposal(revert)).toBe(true);
    // A normal start would be refused: the opportunity already has a pull request.
    expect(await repo.beginExecution(attempt(revert))).toBe(false);
    expect(
      await repo.beginExecution({ ...attempt(revert), revert: true }),
    ).toBe(true);
    expect(
      await repo.checkpoint({ ...progress(revert), phase: "failed" }),
    ).toBe(true);
    expect(await opportunity(input)).toMatchObject({ status: "in_progress" });
  });

  it("marks the opportunity reverted after a shipped revert, with a decision row", async () => {
    const input = await fixture(database);
    expect(await repo.saveProposal(input)).toBe(true);
    await shipped(input);
    const revert = await revertOf(input);
    expect(await repo.saveProposal(revert)).toBe(true);
    expect(
      await repo.beginExecution({ ...attempt(revert), revert: true }),
    ).toBe(true);
    await repo.checkpoint({
      ...progress(revert),
      phase: "pull_request_created",
      commitSha: "revert-commit",
      pullRequestNumber: 43,
      pullRequestUrl: "https://github.com/owner/site/pull/43",
    });
    const { version } = await opportunity(input);
    expect(
      await repo.markReverted({
        projectId: input.projectId,
        claimToken: revert.claimToken,
        organizationId: input.organizationId,
        opportunityId: input.proposal.opportunityId,
        revertProposalId: revert.proposal.id,
        expectedVersion: Number(version),
        fromStatus: "in_progress",
        actorUserId: "reviewer",
        note: "Revert deployed.",
      }),
    ).toBe(true);
    expect(await opportunity(input)).toMatchObject({ status: "reverted" });
    const [decision] = (
      await client.execute({
        sql: "SELECT decision, to_status, actor_user_id FROM opportunity_decisions WHERE opportunity_id = ? AND decision = 'reverted'",
        args: [input.proposal.opportunityId],
      })
    ).rows;
    expect(decision).toMatchObject({
      to_status: "reverted",
      actor_user_id: "reviewer",
    });
  });
});
