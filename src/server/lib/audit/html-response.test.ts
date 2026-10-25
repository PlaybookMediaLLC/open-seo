import { expect, it } from "vitest";
import { readTextUpTo } from "./html-response";

it("finishes a bounded clone read before the original response is consumed", async () => {
  const body = "x".repeat(160);
  const response = new Response(body);

  expect(await readTextUpTo(response.clone(), 80)).toBe(body.slice(0, 80));
  expect(await response.text()).toBe(body);
});
