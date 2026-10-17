import { describe, expect, it } from "vitest";
import { measurementRefreshDue } from "./measurementSchedule";

const now = new Date("2026-10-17T12:00:00.000Z");
const deployed = { deployedAt: "2026-09-01T00:00:00.000Z", autoRefresh: true };
const run = (hoursAgo: number, windowComplete = false) => ({
  windowComplete,
  finishedAt: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
});

describe("measurementRefreshDue", () => {
  it("is due for a deployed experiment with no measurement yet", () => {
    expect(measurementRefreshDue(deployed, null, now)).toBe(true);
  });
  it("waits for the deployment and respects the switch", () => {
    expect(
      measurementRefreshDue({ ...deployed, deployedAt: null }, null, now),
    ).toBe(false);
    expect(
      measurementRefreshDue({ ...deployed, autoRefresh: false }, null, now),
    ).toBe(false);
  });
  it("waits 24 hours after the last measurement", () => {
    expect(measurementRefreshDue(deployed, run(23), now)).toBe(false);
    expect(measurementRefreshDue(deployed, run(24), now)).toBe(true);
  });
  it("stops after the final result", () => {
    expect(measurementRefreshDue(deployed, run(48, true), now)).toBe(false);
  });
});
