import { createHmac } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { readSignedBody } from "./internalAuth";

const env = vi.hoisted(() => ({ values: {} as Record<string, string> }));
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: async (name: string) => env.values[name],
}));

const SECRET = "test-secret";
function request(
  body: string,
  options: {
    secret?: string;
    age?: number;
    method?: string;
    length?: number;
  } = {},
) {
  const timestamp = String(Math.floor(Date.now() / 1000) - (options.age ?? 0));
  const signature = createHmac("sha256", options.secret ?? SECRET)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return new Request("https://relay.test/api/internal/growth/due", {
    method: options.method ?? "POST",
    headers: {
      "x-relay-timestamp": timestamp,
      "x-relay-signature": signature,
      ...(options.length ? { "content-length": String(options.length) } : {}),
    },
    body: options.method === "GET" ? undefined : body,
  });
}

beforeEach(() => {
  env.values = { GROWTH_JOBS_SECRET: SECRET, GROWTH_JOBS_MODE: "trigger" };
});

it("accepts a fresh request signed with the secret", async () => {
  expect(await readSignedBody(request('{"a":1}'))).toEqual({ a: 1 });
});

it("refuses a wrong signature", async () => {
  expect(await readSignedBody(request("{}", { secret: "other" }))).toBeNull();
});

it("refuses a timestamp older than five minutes", async () => {
  expect(await readSignedBody(request("{}", { age: 600 }))).toBeNull();
});

it("refuses a body over 64 KB", async () => {
  expect(await readSignedBody(request(`"${"x".repeat(70_000)}"`))).toBeNull();
});

it("refuses everything when the jobs mode is off", async () => {
  env.values.GROWTH_JOBS_MODE = "off";
  expect(await readSignedBody(request("{}"))).toBeNull();
  env.values = { GROWTH_JOBS_SECRET: SECRET };
  // Without Trigger.dev the mode defaults to off.
  expect(await readSignedBody(request("{}"))).toBeNull();
});

it("accepts the previous secret during a rotation", async () => {
  env.values.GROWTH_JOBS_SECRET_PREVIOUS = "old-secret";
  expect(await readSignedBody(request("{}", { secret: "old-secret" }))).toEqual(
    {},
  );
});
