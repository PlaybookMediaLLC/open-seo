import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { shiftGa4Date } from "@/server/features/ga4/services/Ga4Dates";
import type {
  GrowthExperiment,
  MeasurementDay,
  MeasurementRun,
} from "@/types/schemas/experiments";
import { nextClaim } from "../../publishing/repositories/publishingTestFixtures";
import { ExperimentRepository as repo } from "./ExperimentRepository";
import {
  newExperiment,
  runningMeasurement,
  succeededExecution,
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

type Input = Awaited<ReturnType<typeof succeededExecution>>;
const mergedAt = new Date(Date.now() - 40 * 86_400_000).toISOString();
const deployedAt = new Date(Date.now() - 39 * 86_400_000).toISOString();
const windows = {
  baselineStart: "2026-08-01",
  baselineEnd: "2026-08-28",
  observationStart: "2026-09-05",
  observationEnd: "2026-10-02",
};

async function registered() {
  const input = await succeededExecution(database);
  const experiment = newExperiment(input);
  expect(await repo.register({ ...input, experiment })).toBe(true);
  return { input, experiment };
}

function scope(input: Input, experiment: GrowthExperiment) {
  return {
    projectId: input.projectId,
    experimentId: experiment.id,
    claimToken: input.claimToken,
    organizationId: input.organizationId,
  };
}

function merged(input: Input, experiment: GrowthExperiment, sha = "merge") {
  return repo.recordPullStatus({
    ...scope(input, experiment),
    connectionId: input.connection.id,
    state: "merged",
    checkedAt: new Date().toISOString(),
    mergedAt,
    mergeCommitSha: sha,
  });
}

function confirm(input: Input, experiment: GrowthExperiment, at = deployedAt) {
  return repo.confirmDeployment({
    ...scope(input, experiment),
    deployedAt: at,
    confirmedBy: "reviewer",
    note: "Verified live",
    confirmedAt: new Date().toISOString(),
    otherChanges: false,
    seasonalRisk: false,
    ...windows,
  });
}

async function deployed() {
  const { input, experiment } = await registered();
  expect(await merged(input, experiment)).toBe(true);
  expect(await confirm(input, experiment)).toBe(true);
  return { input, experiment };
}

function days(run: MeasurementRun, period: MeasurementDay["period"]) {
  const start =
    period === "baseline" ? windows.baselineStart : windows.observationStart;
  return Array.from({ length: 28 }, (_, index) => ({
    id: crypto.randomUUID(),
    projectId: run.projectId,
    experimentId: run.experimentId,
    runId: run.id,
    period,
    date: shiftGa4Date(start, index),
    clicks: 5,
    impressions: 50,
    ctr: 0.1,
    position: 10,
  }));
}

function completed(run: MeasurementRun): MeasurementRun {
  return {
    ...run,
    status: "completed",
    finishedAt: new Date().toISOString(),
    observationThrough: windows.observationEnd,
    windowComplete: true,
    outcome: "inconclusive",
    explanation: "Done",
  };
}

async function status(table: string, id: string) {
  return (
    await client.execute({
      sql: `SELECT status FROM ${table} WHERE id = ?`,
      args: [id],
    })
  ).rows[0]?.status;
}

describe(`ExperimentRepository real ${database.isPostgres ? "Postgres" : "SQLite"}`, () => {
  it("registers one experiment per succeeded execution and returns it idempotently", async () => {
    const { input, experiment } = await registered();
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
    const { input, experiment } = await registered();
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
    const { input, experiment } = await registered();
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
    expect(await status("opportunities", experiment.opportunityId)).toBe(
      "implemented",
    );
  });

  it("rejects deployment when the pull request check is stale", async () => {
    const { input, experiment } = await registered();
    expect(await merged(input, experiment)).toBe(true);
    await client.execute({
      sql: "UPDATE growth_experiments SET pull_request_checked_at = ? WHERE id = ?",
      args: [new Date(Date.now() - 600_000).toISOString(), experiment.id],
    });
    expect(await confirm(input, experiment)).toBe(false);
  });

  it("pins the first baseline, appends observations and reads the latest completed snapshot", async () => {
    const { input, experiment } = await deployed();
    const first = runningMeasurement(experiment, input.claimToken);
    expect(await repo.startRun({ ...input, run: first })).toBe(true);
    expect(
      await repo.completeRun({
        ...input,
        run: completed(first),
        days: [...days(first, "baseline"), ...days(first, "observation")],
      }),
    ).toBe(true);
    await client.execute({
      sql: "UPDATE measurement_runs SET started_at = ?, finished_at = ? WHERE id = ?",
      args: [
        new Date(Date.now() - 2 * 86_400_000).toISOString(),
        new Date(Date.now() - 2 * 86_400_000).toISOString(),
        first.id,
      ],
    });

    const next = await nextClaim(input);
    const rebaseline = runningMeasurement(experiment, next.claimToken, true);
    expect(await repo.startRun({ ...next, run: rebaseline })).toBe(false);
    const second = runningMeasurement(experiment, next.claimToken, false);
    expect(await repo.startRun({ ...next, run: second })).toBe(true);
    expect(
      await repo.completeRun({
        ...next,
        run: completed(second),
        days: days(second, "baseline"),
      }),
    ).toBe(false);
    expect(
      await repo.completeRun({
        ...next,
        run: completed(second),
        days: days(second, "observation"),
      }),
    ).toBe(true);

    const last = await nextClaim(input);
    const failing = runningMeasurement(experiment, last.claimToken, false);
    await client.execute({
      sql: "UPDATE measurement_runs SET started_at = ?, finished_at = ? WHERE id = ?",
      args: [
        new Date(Date.now() - 2 * 86_400_000).toISOString(),
        new Date(Date.now() - 2 * 86_400_000).toISOString(),
        second.id,
      ],
    });
    expect(await repo.startRun({ ...last, run: failing })).toBe(true);
    expect(
      await repo.failRun({
        ...scope(last, experiment),
        runId: failing.id,
        message: "Bearer secret-token github_pat_abc123 failed",
      }),
    ).toBe(true);

    const detail = await repo.get(input.projectId, experiment.id);
    expect(detail?.experiment.baselineRunId).toBe(first.id);
    expect(detail?.baselineDays.every((day) => day.runId === first.id)).toBe(
      true,
    );
    expect(detail?.baselineDays).toHaveLength(28);
    expect(
      detail?.observationDays.every((day) => day.runId === second.id),
    ).toBe(true);
    expect(detail?.runs.map((run) => run.id)).toEqual([
      failing.id,
      second.id,
      first.id,
    ]);
    expect(detail?.runs[0].error).toBe("Bearer [redacted] [redacted] failed");
    expect(detail?.latestRun?.id).toBe(second.id);
    expect(detail?.runs[0]).not.toHaveProperty("claimToken");
    expect(await status("opportunities", experiment.opportunityId)).toBe(
      "completed",
    );
  });

  it("enforces cache, failure cooldown and the five-attempt project budget before admission", async () => {
    const { input, experiment } = await deployed();
    const first = runningMeasurement(experiment, input.claimToken);
    expect(await repo.startRun({ ...input, run: first })).toBe(true);
    expect(
      await repo.failRun({
        ...scope(input, experiment),
        runId: first.id,
        message: "x",
      }),
    ).toBe(true);
    let claim = await nextClaim(input);
    expect(
      await repo.startRun({
        ...claim,
        run: runningMeasurement(experiment, claim.claimToken),
      }),
    ).toBe(false);
    await client.execute({
      sql: "UPDATE measurement_runs SET finished_at = ? WHERE id = ?",
      args: [new Date(Date.now() - 600_000).toISOString(), first.id],
    });
    for (let attempt = 2; attempt <= 5; attempt += 1) {
      claim = await nextClaim(input);
      const run = runningMeasurement(experiment, claim.claimToken);
      expect(await repo.startRun({ ...claim, run })).toBe(true);
      expect(
        await repo.failRun({
          ...scope(claim, experiment),
          runId: run.id,
          message: "x",
        }),
      ).toBe(true);
      await client.execute({
        sql: "UPDATE measurement_runs SET finished_at = ? WHERE id = ?",
        args: [new Date(Date.now() - 600_000).toISOString(), run.id],
      });
    }
    claim = await nextClaim(input);
    expect(
      await repo.startRun({
        ...claim,
        run: runningMeasurement(experiment, claim.claimToken),
      }),
    ).toBe(false);
    await client.execute({
      sql: "UPDATE measurement_runs SET started_at = ? WHERE project_id = ?",
      args: [
        new Date(Date.now() - 2 * 86_400_000).toISOString(),
        input.projectId,
      ],
    });
    const run = runningMeasurement(experiment, claim.claimToken);
    expect(await repo.startRun({ ...claim, run })).toBe(true);
    expect(
      await repo.completeRun({
        ...claim,
        run: completed(run),
        days: days(run, "baseline"),
      }),
    ).toBe(true);
    claim = await nextClaim(input);
    expect(
      await repo.startRun({
        ...claim,
        run: runningMeasurement(experiment, claim.claimToken, false),
      }),
    ).toBe(false);
  });

  it("abandons an expired running claim and rejects late writes from the replaced claim", async () => {
    const { input, experiment } = await deployed();
    const stale = runningMeasurement(experiment, input.claimToken);
    expect(await repo.startRun({ ...input, run: stale })).toBe(true);
    const next = await nextClaim(input);
    const fresh = runningMeasurement(experiment, next.claimToken);
    expect(await repo.startRun({ ...next, run: fresh })).toBe(true);
    expect(await status("measurement_runs", stale.id)).toBe("failed");
    expect(
      await repo.completeRun({
        ...input,
        run: completed(stale),
        days: days(stale, "baseline"),
      }),
    ).toBe(false);
    expect(
      await repo.failRun({
        ...scope(input, experiment),
        runId: stale.id,
        message: "late",
      }),
    ).toBe(false);
  });

  it("rejects measurement admission and completion after the Search Console property changes", async () => {
    const { input, experiment } = await deployed();
    const run = runningMeasurement(experiment, input.claimToken);
    expect(await repo.startRun({ ...input, run })).toBe(true);
    await client.execute({
      sql: "UPDATE gsc_connections SET site_url = 'sc-domain:other.com' WHERE project_id = ?",
      args: [input.projectId],
    });
    expect(
      await repo.completeRun({
        ...input,
        run: completed(run),
        days: days(run, "baseline"),
      }),
    ).toBe(false);
    const detail = await repo.get(input.projectId, experiment.id);
    expect(detail?.experiment.baselineRunId).toBeNull();
    expect(detail?.baselineDays).toEqual([]);
  });

  it("flags another deployed experiment on the same page inside the windows, scoped to the project", async () => {
    const { input, experiment } = await deployed();
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
    const other = await deployed();
    expect(await repo.get(other.input.projectId, experiment.id)).toBeNull();
    expect(
      await repo.hasOverlappingChanges(other.input.projectId, experiment.id),
    ).toBe(false);
  });
});
