import { expect, it } from "vitest";
import { workSummary } from "./workSummary";

it("puts pending decisions ahead of new work or a setup warning", () => {
  expect(
    workSummary({
      waiting: 2,
      nextTitle: "Another task",
      emptyReasons: "Connect a source.",
    }),
  ).toBe("2 items need your review.");
});
it("keeps an empty queue's readiness reason visible", () => {
  expect(
    workSummary({
      waiting: 0,
      emptyReasons: "Connect GitHub to prepare changes.",
    }),
  ).toBe("Connect GitHub to prepare changes.");
});
it("does not call missing work an all-clear", () => {
  expect(workSummary({ waiting: 0 })).toContain("Review your sources");
});
