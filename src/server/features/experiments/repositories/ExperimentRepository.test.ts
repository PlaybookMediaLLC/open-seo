import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ExperimentRepository as repo } from "./ExperimentRepository";
import {
  confirm,
  deployed,
  deployedAt,
  merged,
  mergedAt,
  newExperiment,
  registered,
  scope,
  status,
  succeededExecution,
  windows,
} from "./experimentTestFixtures";

const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } = await import("./experimentTestDb");
  return createExperimentTestDatabase();
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

describe(`ExperimentRepository real ${database.isPostgres ? "Postgres" : "SQLite"}`, () => {
  it("registers one experiment per succeeded execution and returns it idempotently", async () => {
    const { input, experiment } = await registered(database);
    const duplicate = { ...newExperiment(input), id: crypto.randomUUID() };
    expect(await repo.register({ ...input, experiment: duplicate })).toBe(
      false,
    );
    expect(
      await repo.getForExecution(input.projectId, input.executionId),
    ).toEqual(experiment);
    const listed = await repo.list({
      projectId: input.projectId,
      limit: 50,
      offset: 0,
    });
    expect(listed.total).toBe(1);
    expect(listed.items[0]).toMatchObject({
      id: experiment.id,
      opportunityTitle: "Improve page",
      pullRequestUrl: "https://github.com/owner/site/pull/42",
      latestRun: null,
    });
    expect(listed.items[0]).not.toHaveProperty("lastEventId");
  });

  it("rejects registration from another project, a stale claim or a changed property", async () => {
    const input = await succeededExecution(database);
    const other = await succeededExecution(database);
    expect(
      await repo.register({
        ...other,
        experiment: { ...newExperiment(input), projectId: other.projectId },
      }),
    ).toBe(false);
    expect(
      await repo.register({
        ...input,
        claimToken: "stale",
        experiment: newExperiment(input),
      }),
    ).toBe(false);
    await client.execute({
      sql: "UPDATE gsc_connections SET site_url = 'sc-domain:other.com' WHERE project_id = ?",
      args: [input.projectId],
    });
    expect(
      await repo.register({ ...input, experiment: newExperiment(input) }),
    ).toBe(false);
    expect(
      await repo.getForExecution(input.projectId, input.executionId),
    ).toBeNull();
  });

  it("keeps a verified merge immutable and requires the original active repository", async () => {
    const { input, experiment } = await registered(database);
    expect(await merged(input, experiment)).toBe(true);
    expect(await merged(input, experiment, "different")).toBe(false);
    expect(
      await repo.recordPullStatus({
        ...scope(input, experiment),
        connectionId: input.connection.id,
        state: "open",
        checkedAt: new Date().toISOString(),
        mergedAt: null,
        mergeCommitSha: null,
      }),
    ).toBe(false);
    expect(await merged(input, experiment)).toBe(true);
    await client.execute({
      sql: "UPDATE publishing_connections SET revoked_at = ? WHERE id = ?",
      args: [new Date().toISOString(), input.connection.id],
    });
    expect(await merged(input, experiment)).toBe(false);
  });

  it("records one immutable deployment attestation only after a recent verified merge", async () => {
    const { input, experiment } = await registered(database);
    expect(await confirm(input, experiment)).toBe(false);
    expect(await merged(input, experiment)).toBe(true);
    const beforeMerge = new Date(Date.parse(mergedAt) - 1000).toISOString();
    expect(await confirm(input, experiment, beforeMerge)).toBe(false);
    expect(
      await confirm(
        input,
        experiment,
        new Date(Date.now() + 60_000).toISOString(),
      ),
    ).toBe(false);
    expect(await confirm(input, experiment)).toBe(true);
    expect(await confirm(input, experiment)).toBe(false);
    const detail = await repo.get(input.projectId, experiment.id);
    expect(detail?.experiment).toMatchObject({
      deployedAt,
      deploymentNote: "Verified live",
      ...windows,
    });
    expect(
      await status(database, "opportunities", experiment.opportunityId),
    ).toBe("implemented");
  });

  it("rejects deployment when the pull request check is stale", async () => {
    const { input, experiment } = await registered(database);
    expect(await merged(input, experiment)).toBe(true);
    await client.execute({
      sql: "UPDATE growth_experiments SET pull_request_checked_at = ? WHERE id = ?",
      args: [new Date(Date.now() - 600_000).toISOString(), experiment.id],
    });
    expect(await confirm(input, experiment)).toBe(false);
  });

  it("flags another deployed experiment on the same page inside the windows, scoped to the project", async () => {
    const { input, experiment } = await deployed(database);
    expect(
      await repo.hasOverlappingChanges(input.projectId, experiment.id),
    ).toBe(false);
    const executionId = crypto.randomUUID();
    await client.execute({
      sql: "INSERT INTO proposal_executions SELECT ?, project_id, proposal_id, approval_id, status, phase, ?, started_at, finished_at, request_count, commit_sha, pull_request_number, pull_request_url, error, last_event_id FROM proposal_executions WHERE id = ?",
      args: [executionId, `branch-${executionId}`, input.executionId],
    });
    await client.execute({
      sql: "INSERT INTO growth_experiments SELECT ?, project_id, opportunity_id, proposal_id, ?, site_url, target_url, created_by, created_at, pull_request_state, pull_request_checked_at, merged_at, merge_commit_sha, ?, deployment_confirmed_by, deployment_note, deployment_confirmed_at, other_changes, seasonal_risk, baseline_start, baseline_end, observation_start, observation_end, NULL, NULL FROM growth_experiments WHERE id = ?",
      args: [
        crypto.randomUUID(),
        executionId,
        "2026-09-10T12:00:00.000Z",
        experiment.id,
      ],
    });
    expect(
      await repo.hasOverlappingChanges(input.projectId, experiment.id),
    ).toBe(true);
    const other = await deployed(database);
    expect(await repo.get(other.input.projectId, experiment.id)).toBeNull();
    expect(
      await repo.hasOverlappingChanges(other.input.projectId, experiment.id),
    ).toBe(false);
  });
});
