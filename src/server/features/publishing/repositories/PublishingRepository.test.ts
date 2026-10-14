import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PublishingRepository as repo } from "./PublishingRepository";
import { attempt, fixture, nextClaim } from "./publishingTestFixtures";
import { db } from "@/db";
import { opportunityRuns } from "@/db/schema";
import { opportunityRun } from "../../opportunities/services/opportunityTestFixtures";

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

describe(`PublishingRepository real ${database.isPostgres ? "Postgres" : "SQLite"}`, () => {
  it("replaces and disconnects immutable configuration revisions without exposing private fields", async () => {
    const input = await fixture(database);
    expect(await repo.saveProposal(input)).toBe(true);
    const next = {
      ...input.connection,
      id: crypto.randomUUID(),
      repository: "replacement",
    };
    expect(await repo.replaceConnection({ ...input, connection: next })).toBe(
      true,
    );
    expect(
      await repo.getConnectionById(input.projectId, input.connection.id),
    ).toEqual({
      ...input.connection,
      revokedAt: expect.any(String) as unknown,
      encryptedToken: null,
    });
    expect(await repo.getConnection(input.projectId)).toEqual(next);
    const history = await repo.getProposal(input.projectId, input.proposal.id);
    expect(history?.connection.repository).toBe("site");
    expect(history?.connection).not.toHaveProperty("encryptedToken");
    expect(history?.connection).not.toHaveProperty("lastEventId");
    expect(await repo.disconnect(input)).toBe(true);
    expect(await repo.disconnect(input)).toBe(false);
    expect(await repo.getConnection(input.projectId)).toBeNull();
    expect(
      (await repo.getConnectionById(input.projectId, next.id))?.encryptedToken,
    ).toBeNull();
  });

  it.each([
    [
      "expired",
      "UPDATE data_refresh_claims SET next_attempt_at = 0 WHERE key = ?",
    ],
    [
      "replaced",
      "UPDATE data_refresh_claims SET token = 'replacement' WHERE key = ?",
    ],
    [
      "foreign organization",
      "UPDATE data_refresh_claims SET organization_id = 'opportunity-test-foreign' WHERE key = ?",
    ],
  ])(
    "rejects all preparatory mutations under a %s claim",
    async (_name, sql) => {
      const input = await fixture(database);
      await client.execute({ sql, args: [`publishing:${input.projectId}`] });
      expect(await repo.disconnect(input)).toBe(false);
      expect(
        await repo.replaceConnection({
          ...input,
          connection: { ...input.connection, id: crypto.randomUUID() },
        }),
      ).toBe(false);
      expect(await repo.saveProposal(input)).toBe(false);
      expect(await repo.getConnection(input.projectId)).toEqual(
        input.connection,
      );
      expect(
        await repo.getProposal(input.projectId, input.proposal.id),
      ).toBeNull();
    },
  );

  it("scopes every read and parent reference to the project", async () => {
    const own = await fixture(database);
    const foreign = await fixture(database);
    expect(await repo.saveProposal(own)).toBe(true);
    expect(
      await repo.getConnectionById(foreign.projectId, own.connection.id),
    ).toBeNull();
    expect(
      await repo.getProposal(foreign.projectId, own.proposal.id),
    ).toBeNull();
    expect(
      await repo.listProposals(foreign.projectId, own.proposal.opportunityId),
    ).toEqual([]);
    expect(
      await repo.saveProposal({
        ...foreign,
        proposal: { ...foreign.proposal, connectionId: own.connection.id },
      }),
    ).toBe(false);
    expect(
      await repo.saveProposal({
        ...foreign,
        proposal: {
          ...foreign.proposal,
          opportunityId: own.proposal.opportunityId,
        },
      }),
    ).toBe(false);
    expect(
      await repo.disconnect({ ...own, organizationId: foreign.organizationId }),
    ).toBe(false);
  });

  it.each([
    [
      "version",
      "UPDATE opportunities SET version = version + 1 WHERE project_id = ?",
    ],
    [
      "review status",
      "UPDATE opportunities SET status = 'rejected' WHERE project_id = ?",
    ],
    [
      "revoked connection",
      "UPDATE publishing_connections SET revoked_at = '2026-01-01', encrypted_token = NULL WHERE project_id = ?",
    ],
  ])("rejects preparation after changed %s", async (_name, sql) => {
    const input = await fixture(database);
    await client.execute({ sql, args: [input.projectId] });
    expect(await repo.saveProposal(input)).toBe(false);
  });

  it("requires approval of current evidence even when rediscovery retains approved status", async () => {
    const input = await fixture(database);
    const run = opportunityRun({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      siteUrl: input.siteUrl,
    });
    await db.insert(opportunityRuns).values(run);
    await client.execute({
      sql: "UPDATE opportunities SET evidence_run_id = ?, version = 3 WHERE id = ?",
      args: [run.id, input.proposal.opportunityId],
    });
    const proposal = {
      ...input.proposal,
      evidenceRunId: run.id,
      opportunityVersion: 3,
    };
    expect(await repo.saveProposal({ ...input, proposal })).toBe(false);
    await client.execute({
      sql: "INSERT INTO opportunity_decisions (id,project_id,opportunity_id,evidence_run_id,actor_user_id,decision,from_status,to_status,note,created_at) VALUES (?,?,?,?, 'reviewer','approved','approved','approved','Review new evidence',?)",
      args: [
        crypto.randomUUID(),
        input.projectId,
        proposal.opportunityId,
        run.id,
        new Date().toISOString(),
      ],
    });
    expect(await repo.saveProposal({ ...input, proposal })).toBe(true);
  });

  it("returns only the newest twenty proposals", async () => {
    const input = await fixture(database);
    for (let index = 0; index < 22; index++) {
      expect(
        await repo.saveProposal({
          ...input,
          proposal: {
            ...input.proposal,
            id: `proposal-${index}-${input.projectId}`,
            createdAt: new Date(Date.now() + index * 1000).toISOString(),
          },
        }),
      ).toBe(true);
    }
    const rows = await repo.listProposals(
      input.projectId,
      input.proposal.opportunityId,
    );
    expect(rows).toHaveLength(20);
    expect(rows[0].proposal.id).toBe(`proposal-21-${input.projectId}`);
    expect(rows[19].proposal.id).toBe(`proposal-2-${input.projectId}`);
  });

  it("cascades project deletion through all publishing history", async () => {
    const input = await fixture(database);
    await repo.saveProposal(input);
    expect(await repo.beginExecution(attempt(input))).toBe(true);
    await client.execute({
      sql: "DELETE FROM projects WHERE id = ?",
      args: [input.projectId],
    });
    for (const table of [
      "publishing_connections",
      "opportunity_proposals",
      "proposal_approvals",
      "proposal_executions",
      "proposal_execution_events",
    ]) {
      const result = await client.execute({
        sql: `SELECT count(*) AS n FROM ${table} WHERE project_id = ?`,
        args: [input.projectId],
      });
      expect(Number(result.rows[0].n)).toBe(0);
    }
  });

  it("preserves approval and execution history when a connection is revoked", async () => {
    const input = await fixture(database);
    await repo.saveProposal(input);
    expect(await repo.beginExecution(attempt(input))).toBe(true);
    const before = await repo.getProposal(input.projectId, input.proposal.id);
    const next = await nextClaim(input);
    expect(await repo.disconnect(next)).toBe(true);
    const after = await repo.getProposal(input.projectId, input.proposal.id);
    expect(after?.approvals).toEqual(before?.approvals);
    expect(after?.executions).toEqual(before?.executions);
    expect(after?.events).toEqual(before?.events);
  });
});
