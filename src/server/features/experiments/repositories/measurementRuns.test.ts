import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { nextClaim } from "../../publishing/repositories/publishingTestFixtures";
import { ExperimentRepository as repo } from "./ExperimentRepository";
import {
  completed,
  days,
  deployed,
  runningMeasurement,
  scope,
  status,
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

describe(`Experiment measurement runs real ${database.isPostgres ? "Postgres" : "SQLite"}`, () => {
  it("pins the first baseline, appends observations and reads the latest completed snapshot", async () => {
    const { input, experiment } = await deployed(database);
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
    expect(
      await status(database, "opportunities", experiment.opportunityId),
    ).toBe("completed");
  });

  it("enforces cache, failure cooldown and the five-attempt project budget before admission", async () => {
    const { input, experiment } = await deployed(database);
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
    const { input, experiment } = await deployed(database);
    const stale = runningMeasurement(experiment, input.claimToken);
    expect(await repo.startRun({ ...input, run: stale })).toBe(true);
    const next = await nextClaim(input);
    const fresh = runningMeasurement(experiment, next.claimToken);
    expect(await repo.startRun({ ...next, run: fresh })).toBe(true);
    expect(await status(database, "measurement_runs", stale.id)).toBe("failed");
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
    const { input, experiment } = await deployed(database);
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
});
