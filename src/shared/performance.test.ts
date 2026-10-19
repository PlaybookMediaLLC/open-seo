import { describe, expect, it } from "vitest";
import { causesFor, PERFORMANCE_CAUSES } from "./performance";

// RFC-0014 5.4: one test per Lighthouse id in the cause table.
describe("causesFor", () => {
  it.each(
    PERFORMANCE_CAUSES.flatMap((cause) =>
      cause.lighthouseIds.map((id) => [id, cause.id] as const),
    ),
  )("maps %s to %s", (id, cause) => {
    expect(causesFor([id]).map((item) => item.id)).toContain(cause);
  });

  it("names no cause for an id outside the table", () => {
    expect(causesFor(["uses-text-compression"])).toEqual([]);
  });
});
