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

async function prepared() {
  const input = await fixture(database);
  expect(await repo.saveProposal(input)).toBe(true);
  return input;
}
function progress(input: Awaited<ReturnType<typeof fixture>>) {
  return {
    projectId: input.projectId,
    executionId: input.claimToken,
    organizationId: input.organizationId,
    requestCount: 3,
    message: "Checkpoint",
  };
}
async function opportunity(input: Awaited<ReturnType<typeof fixture>>) {
  return (
    await client.execute({
      sql: "SELECT status, version FROM opportunities WHERE id = ?",
      args: [input.proposal.opportunityId],
    })
  ).rows[0];
}

describe(`Publishing execution real ${database.isPostgres ? "Postgres" : "SQLite"}`, () => {
  it("admits only one competing approval and atomically starts its audit trail", async () => {
    const input = await prepared();
    const results = await Promise.all([
      repo.beginExecution(attempt(input)),
      repo.beginExecution(attempt(input)),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const history = await repo.getProposal(input.projectId, input.proposal.id);
    expect(history?.approvals).toHaveLength(1);
    expect(history?.executions).toHaveLength(1);
    expect(history?.executions[0]).not.toHaveProperty("lastEventId");
    expect(history?.events).toMatchObject([{ phase: "validating" }]);
    expect(await opportunity(input)).toMatchObject({
      status: "in_progress",
      version: 3,
    });
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
      "foreign organization",
      "UPDATE data_refresh_claims SET organization_id = 'opportunity-test-foreign' WHERE key = ?",
      "claim",
    ],
    [
      "changed property",
      "UPDATE gsc_connections SET site_url = 'sc-domain:other.com' WHERE project_id = ?",
      "project",
    ],
    [
      "stale evidence",
      "UPDATE opportunities SET last_detected_at = '2020-01-01' WHERE project_id = ?",
      "project",
    ],
    [
      "new opportunity version",
      "UPDATE opportunities SET version = version + 1 WHERE project_id = ?",
      "project",
    ],
    [
      "revoked connection",
      "UPDATE publishing_connections SET revoked_at = '2026-01-01', encrypted_token = NULL WHERE project_id = ?",
      "project",
    ],
    [
      "archived project",
      "UPDATE projects SET archived_at = '2026-01-01' WHERE id = ?",
      "project",
    ],
  ])(
    "rejects %s without writing execution history",
    async (_name, sql, scope) => {
      const input = await prepared();
      await client.execute({
        sql,
        args: [
          scope === "claim" ? `publishing:${input.projectId}` : input.projectId,
        ],
      });
      expect(await repo.beginExecution(attempt(input))).toBe(false);
      const history = await repo.getProposal(
        input.projectId,
        input.proposal.id,
      );
      expect(history?.approvals).toEqual([]);
      expect(history?.executions).toEqual([]);
      expect(history?.events).toEqual([]);
      expect((await opportunity(input)).status).toBe("approved");
    },
  );

  it("rejects an evidence pointer change even when the version is unchanged", async () => {
    const input = await prepared();
    const next = await fixture(database);
    await client.execute({
      sql: "UPDATE opportunities SET evidence_run_id = ? WHERE id = ?",
      args: [next.proposal.evidenceRunId, input.proposal.opportunityId],
    });
    expect(await repo.beginExecution(attempt(input))).toBe(false);
    expect(
      await repo.saveProposal({
        ...input,
        proposal: { ...input.proposal, id: crypto.randomUUID() },
      }),
    ).toBe(false);
  });

  it("supports forward recovery, rejects regressions and late failure after success", async () => {
    const input = await prepared();
    expect(await repo.beginExecution(attempt(input))).toBe(true);
    expect(
      await repo.checkpoint({
        ...progress(input),
        phase: "file_committed",
        commitSha: "commit",
      }),
    ).toBe(true);
    expect(
      await repo.checkpoint({ ...progress(input), phase: "branch_created" }),
    ).toBe(false);
    expect(
      await repo.checkpoint({
        ...progress(input),
        phase: "pull_request_created",
        pullRequestNumber: 42,
        pullRequestUrl: "https://github.com/owner/site/pull/42",
      }),
    ).toBe(true);
    const before = await repo.getProposal(input.projectId, input.proposal.id);
    expect(await repo.checkpoint({ ...progress(input), phase: "failed" })).toBe(
      false,
    );
    expect(await repo.getProposal(input.projectId, input.proposal.id)).toEqual(
      before,
    );
    expect(before?.executions[0]).toMatchObject({
      status: "succeeded",
      commitSha: "commit",
      pullRequestNumber: 42,
      finishedAt: expect.any(String) as unknown,
      error: null,
    });
    expect(before?.events).toHaveLength(3);
    expect((await opportunity(input)).status).toBe("in_progress");
    expect(await repo.beginExecution(attempt(await nextClaim(input)))).toBe(
      false,
    );
  });

  it("retries a failed proposal with a new approval while preserving the old failure", async () => {
    const input = await prepared();
    expect(await repo.beginExecution(attempt(input))).toBe(true);
    expect(
      await repo.checkpoint({
        ...progress(input),
        phase: "failed",
        message: "Provider rejected github_pat_secret and Bearer secret",
      }),
    ).toBe(true);
    const failed = await repo.getProposal(input.projectId, input.proposal.id);
    expect(failed?.executions[0].error).toBe(
      "Provider rejected [redacted] and Bearer [redacted]",
    );
    expect((await opportunity(input)).status).toBe("failed");
    const retry = await nextClaim(input);
    expect(await repo.beginExecution(attempt(retry))).toBe(true);
    const after = await repo.getProposal(input.projectId, input.proposal.id);
    expect(after?.approvals).toHaveLength(2);
    expect(after?.executions.find(({ id }) => id === input.claimToken)).toEqual(
      failed?.executions[0],
    );
    expect(after?.events).toHaveLength(3);
    expect(await opportunity(input)).toMatchObject({
      status: "in_progress",
      version: 5,
    });
  });

  it("retires abandoned running attempts and fences their late callbacks", async () => {
    const input = await prepared();
    expect(await repo.beginExecution(attempt(input))).toBe(true);
    const retry = await nextClaim(input);
    expect(
      await repo.checkpoint({ ...progress(input), phase: "file_committed" }),
    ).toBe(false);
    expect(await repo.beginExecution(attempt(retry))).toBe(true);
    const history = await repo.getProposal(input.projectId, input.proposal.id);
    expect(
      history?.executions.find(({ id }) => id === input.claimToken),
    ).toMatchObject({
      status: "failed",
      phase: "failed",
      finishedAt: expect.any(String) as unknown,
    });
    expect(
      history?.events.filter(
        ({ executionId }) => executionId === input.claimToken,
      ),
    ).toHaveLength(2);
    expect(await repo.checkpoint({ ...progress(input), phase: "failed" })).toBe(
      false,
    );
  });

  it("prevents another proposal from running on an opportunity with an existing execution", async () => {
    const input = await prepared();
    const other = {
      ...input,
      proposal: { ...input.proposal, id: crypto.randomUUID() },
    };
    expect(await repo.saveProposal(other)).toBe(true);
    expect(await repo.beginExecution(attempt(input))).toBe(true);
    await client.execute({
      sql: "UPDATE opportunities SET status = 'approved', version = 2 WHERE id = ?",
      args: [input.proposal.opportunityId],
    });
    expect(await repo.beginExecution(attempt(await nextClaim(other)))).toBe(
      false,
    );
    expect(
      (await repo.getProposal(other.projectId, other.proposal.id))?.approvals,
    ).toEqual([]);
  });

  it("rejects expired and foreign-scope checkpoints without adding events", async () => {
    const input = await prepared();
    expect(await repo.beginExecution(attempt(input))).toBe(true);
    expect(
      await repo.checkpoint({
        ...progress(input),
        phase: "failed",
        projectId: "foreign",
      }),
    ).toBe(false);
    expect(
      await repo.checkpoint({
        ...progress(input),
        phase: "failed",
        organizationId: "foreign",
      }),
    ).toBe(false);
    await client.execute({
      sql: "UPDATE data_refresh_claims SET next_attempt_at = 0 WHERE key = ?",
      args: [`publishing:${input.projectId}`],
    });
    expect(await repo.checkpoint({ ...progress(input), phase: "failed" })).toBe(
      false,
    );
    const history = await repo.getProposal(input.projectId, input.proposal.id);
    expect(history?.events).toHaveLength(1);
    expect(history?.executions[0].status).toBe("running");
  });
});
