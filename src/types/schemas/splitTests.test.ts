import { expect, it } from "vitest";
import { backtestPatternSchema } from "./splitTests";

it("rejects unsupported path patterns before a split-test backtest starts", () => {
  expect(
    backtestPatternSchema.safeParse({
      projectId: "project-1",
      pagePattern: "^/(a+)\\1$",
    }).success,
  ).toBe(false);
  expect(
    backtestPatternSchema.safeParse({
      projectId: "project-1",
      pagePattern: "^/integrations/[^/]+$",
    }).success,
  ).toBe(true);
});
