import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { nextClaim } from "../../publishing/repositories/publishingTestFixtures";
import { ExperimentRepository as repo } from "./ExperimentRepository";
import {
  completed,
  days,
  deployed,
  runningMeasurement,
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

// RFC-0006: result labels, the long-term check and GA4 rows, on real SQL.
describe(`Experiment results real ${database.isPostgres ? "Postgres" : "SQLite"}`, () => {
  it("labels an experiment by its final result, filters by label and counts the project", async () => {
    const { input, experiment } = await deployed(database);
    const list = (label?: "encouraging" | "measuring") =>
      repo.list({ projectId: input.projectId, limit: 50, offset: 0, label });
    // No completed run yet: still measuring.
    expect((await list()).summary).toEqual({
      encouraging: 0,
      inconclusive: 0,
      negative: 0,
      measuring: 1,
    });
    const run = runningMeasurement(experiment, input.claimToken);
    expect(await repo.startRun({ ...input, run })).toBe(true);
    expect(
      await repo.completeRun({
        ...input,
        run: { ...completed(run), outcome: "encouraging" },
        days: [...days(run, "baseline"), ...days(run, "observation")],
      }),
    ).toBe(true);
    const all = await list();
    expect(all.summary).toMatchObject({ encouraging: 1, measuring: 0 });
    expect((await list("encouraging")).total).toBe(1);
    const measuring = await list("measuring");
    expect([measuring.total, measuring.items]).toEqual([0, []]);
  });

  it("keeps the primary result when a long-term check completes", async () => {
    const { input, experiment } = await deployed(database);
    const primary = runningMeasurement(experiment, input.claimToken);
    expect(await repo.startRun({ ...input, run: primary })).toBe(true);
    expect(
      await repo.completeRun({
        ...input,
        run: { ...completed(primary), outcome: "encouraging" },
        days: [...days(primary, "baseline"), ...days(primary, "observation")],
      }),
    ).toBe(true);
    const opportunityStatus = await status(
      database,
      "opportunities",
      experiment.opportunityId,
    );
    const next = await nextClaim(input);
    const longTerm = {
      ...runningMeasurement(experiment, next.claimToken, false),
      window: "long_term" as const,
    };
    // The primary result of the last 24 hours does not block this window.
    expect(await repo.startRun({ ...next, run: longTerm })).toBe(true);
    expect(
      await repo.completeRun({
        ...next,
        run: {
          ...completed(longTerm),
          outcome: "negative",
          windowComplete: false,
        },
        days: days(longTerm, "observation"),
      }),
    ).toBe(true);
    const detail = await repo.get(input.projectId, experiment.id);
    expect(detail?.latestRun).toMatchObject({
      id: primary.id,
      outcome: "encouraging",
    });
    expect(detail?.longTermRun).toMatchObject({
      id: longTerm.id,
      outcome: "negative",
    });
    expect(detail?.longTermDays.length).toBeGreaterThan(0);
    expect(
      await status(database, "opportunities", experiment.opportunityId),
    ).toBe(opportunityStatus);
    expect(
      (await repo.list({ projectId: input.projectId, limit: 50, offset: 0 }))
        .summary,
    ).toMatchObject({ encouraging: 1, negative: 0 });
  });

  it("stores the run's GA4 rows and GA4 reason, and reads them back", async () => {
    const { input, experiment } = await deployed(database);
    const run = runningMeasurement(experiment, input.claimToken);
    expect(await repo.startRun({ ...input, run })).toBe(true);
    const ids = {
      projectId: run.projectId,
      runId: run.id,
      experimentId: run.experimentId,
    };
    expect(
      await repo.completeRun({
        ...input,
        run: {
          ...completed(run),
          ga4Error: "Google Analytics reporting quota was exhausted.",
          requestCount: 3,
        },
        days: [...days(run, "baseline"), ...days(run, "observation")],
        ga4Days: [
          {
            ...ids,
            id: crypto.randomUUID(),
            date: "2026-01-02",
            period: "baseline",
            sessions: 40,
            engagedSessions: 30,
            keyEvents: 2,
            revenue: null,
            currency: null,
          },
        ],
        ga4EventTotals: [
          {
            projectId: ids.projectId,
            runId: ids.runId,
            id: crypto.randomUUID(),
            period: "baseline",
            eventName: "contact",
            keyEvents: 3,
          },
        ],
      }),
    ).toBe(true);
    const detail = await repo.get(run.projectId, run.experimentId);
    expect(detail?.latestRun).toMatchObject({
      ga4Error: "Google Analytics reporting quota was exhausted.",
      requestCount: 3,
    });
    expect(detail?.ga4Days.map((day) => [day.date, day.sessions])).toEqual([
      ["2026-01-02", 40],
    ]);
    expect(detail?.ga4EventTotals).toMatchObject([
      { eventName: "contact", keyEvents: 3 },
    ]);
  });
});
