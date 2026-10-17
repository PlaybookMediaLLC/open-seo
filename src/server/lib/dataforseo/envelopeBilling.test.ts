import { expect, it } from "vitest";
import { z } from "zod";
import { parseTaskItems } from "@/server/lib/dataforseo/envelope";

// RFC-0009 debt 1: the metering wrapper settles DataforseoChargedTaskError,
// so a billed task with an invalid payload must throw it with its cost.
it("keeps the provider cost of a billed task whose items fail validation", async () => {
  const task = {
    path: ["v3", "backlinks", "backlinks", "live"],
    cost: 0.02,
    result: [{ items: [{ keyword: 5 }] }],
  };
  await expect(async () =>
    parseTaskItems("backlinks-live", task, z.object({ keyword: z.string() })),
  ).rejects.toMatchObject({
    name: "DataforseoChargedTaskError",
    billing: { costUsd: 0.02, path: task.path },
  });
});
