import { reviewAudit } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PublishingRepository as repo } from "./PublishingRepository";
import { OpportunityRepository } from "../../opportunities/repositories/OpportunityRepository";
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

async function failed() {
  const input = await fixture(database);
  expect(await repo.saveProposal(input)).toBe(true);
  expect(await repo.beginExecution(attempt(input))).toBe(true);
  expect(
    await repo.checkpoint({
      projectId: input.projectId,
      executionId: input.claimToken,
      organizationId: input.organizationId,
      phase: "failed",
      requestCount: 1,
      message: "Base changed",
    }),
  ).toBe(true);
  return input;
}
function recovery(
  input: Awaited<ReturnType<typeof fixture>>,
  executionId: string,
  expectedVersion = 4,
) {
  return {
    projectId: input.projectId,
    opportunityId: input.proposal.opportunityId,
    expectedVersion,
    executionId,
    actorUserId: "reviewer",
    organizationId: input.organizationId,
    claimToken: input.claimToken,
  };
}

describe(`Publishing recovery real ${database.isPostgres ? "Postgres" : "SQLite"}`, () => {
  it("explicitly re-reviews failed work, preserves failure history, and requires a new approval", async () => {
    const input = await failed();
    const before = await repo.getProposal(input.projectId, input.proposal.id);
    const current = await nextClaim(input);
    const request = recovery(current, input.claimToken);
    const winners = await Promise.all([
      repo.recoverOpportunity(request),
      repo.recoverOpportunity(request),
    ]);
    expect(winners.filter(Boolean)).toHaveLength(1);
    expect(await repo.getProposal(input.projectId, input.proposal.id)).toEqual(
      before,
    );
    const detail = await OpportunityRepository.getDetail(
      input.projectId,
      input.proposal.opportunityId,
    );
    expect(detail?.opportunity).toMatchObject({
      status: "reviewed",
      version: 5,
    });
    expect(
      detail?.decisions.filter(({ fromStatus }) => fromStatus === "failed"),
    ).toMatchObject([
      {
        decision: "reviewed",
        toStatus: "reviewed",
        actorUserId: "reviewer",
        evidenceRunId: input.proposal.evidenceRunId,
      },
    ]);
    expect(await repo.beginExecution(attempt(current))).toBe(false);
    expect(
      await repo.saveProposal({
        ...current,
        proposal: {
          ...current.proposal,
          id: crypto.randomUUID(),
          opportunityVersion: 5,
        },
      }),
    ).toBe(false);
    expect(
      await repo.getLatestExecution("foreign", input.proposal.opportunityId),
    ).toBeNull();
    expect(
      (
        await repo.getLatestExecution(
          input.projectId,
          input.proposal.opportunityId,
        )
      )?.proposal.id,
    ).toBe(input.proposal.id);
  });

  it("never retries an older failed proposal after a newer proposal has failed", async () => {
    const input = await failed();
    const current = await nextClaim(input);
    expect(
      await repo.recoverOpportunity(recovery(current, input.claimToken)),
    ).toBe(true);
    expect(
      await OpportunityRepository.review({
        audit: reviewAudit,
        projectId: input.projectId,
        opportunityId: input.proposal.opportunityId,
        expectedVersion: 5,
        actorUserId: "reviewer",
        decision: "approved",
        fromStatus: "reviewed",
        toStatus: "approved",
        note: "Approve new proposal",
        deferredUntil: null,
      }),
    ).toBe(true);
    const newer = {
      ...current,
      proposal: {
        ...current.proposal,
        id: crypto.randomUUID(),
        opportunityVersion: 6,
      },
    };
    expect(await repo.saveProposal(newer)).toBe(true);
    const execution = attempt(newer);
    execution.execution.startedAt = new Date(Date.now() + 1000).toISOString();
    expect(await repo.beginExecution(execution)).toBe(true);
    expect(
      await repo.checkpoint({
        projectId: newer.projectId,
        executionId: newer.claimToken,
        organizationId: newer.organizationId,
        phase: "failed",
        requestCount: 1,
        message: "Base moved again",
      }),
    ).toBe(true);
    const latest = await repo.getLatestExecution(
      input.projectId,
      input.proposal.opportunityId,
    );
    expect(latest?.proposal.id).toBe(newer.proposal.id);
    const retry = await nextClaim(input);
    expect(await repo.beginExecution(attempt(retry))).toBe(false);
    expect(
      await repo.recoverOpportunity(recovery(retry, input.claimToken, 8)),
    ).toBe(false);
    expect(
      await repo.recoverOpportunity(recovery(retry, newer.claimToken, 8)),
    ).toBe(true);
  });

  it.each([
    [
      "expired claim",
      "UPDATE data_refresh_claims SET next_attempt_at = 0 WHERE key = ?",
      "claim",
    ],
    [
      "replaced claim",
      "UPDATE data_refresh_claims SET token = 'other' WHERE key = ?",
      "claim",
    ],
    [
      "wrong organization",
      "UPDATE data_refresh_claims SET organization_id = 'opportunity-test-foreign' WHERE key = ?",
      "claim",
    ],
    [
      "stale version",
      "UPDATE opportunities SET version = version + 1 WHERE id = ?",
      "opportunity",
    ],
    [
      "succeeded execution",
      "UPDATE proposal_executions SET status = 'succeeded' WHERE id = ?",
      "execution",
    ],
    [
      "running execution",
      "UPDATE proposal_executions SET status = 'running' WHERE id = ?",
      "execution",
    ],
  ])(
    "rejects recovery with %s without a decision",
    async (_name, sql, scope) => {
      const input = await failed();
      const current = await nextClaim(input);
      const key =
        scope === "claim"
          ? `publishing:${input.projectId}`
          : scope === "opportunity"
            ? input.proposal.opportunityId
            : input.claimToken;
      await client.execute({ sql, args: [key] });
      expect(
        await repo.recoverOpportunity(recovery(current, input.claimToken)),
      ).toBe(false);
      const detail = await OpportunityRepository.getDetail(
        input.projectId,
        input.proposal.opportunityId,
      );
      expect(detail?.opportunity.status).toBe("failed");
      expect(detail?.decisions).toHaveLength(1);
    },
  );
});
