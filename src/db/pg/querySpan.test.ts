/* oxlint-disable typescript/no-unsafe-type-assertion -- a fake stands in for the postgres.js client */
import { beforeAll, expect, it, vi } from "vitest";
import type postgres from "postgres";
import { withQueryRetries } from "./retry";

const span = vi.hoisted(() => ({ setAttribute: vi.fn() }));
vi.mock("cloudflare:workers", () => ({
  tracing: {
    enterSpan: (_name: string, callback: (s: typeof span) => unknown) =>
      callback(span),
  },
}));

const error = Object.assign(
  new Error("Key (email)=(ada@example.com) already exists."),
  { code: "23505" },
);
const sql = withQueryRetries({
  unsafe: () => Promise.reject(error),
  begin: () => Promise.reject(error),
} as unknown as ReturnType<typeof postgres>);

// The first query of an isolate only starts the load of the tracing API.
beforeAll(async () => {
  await sql.unsafe("select 1").catch(() => {});
  await vi.dynamicImportSettled();
});

it("records the operation and error code on the span, never the message", async () => {
  await expect(
    sql.unsafe("insert into users (email) values ($1)"),
  ).rejects.toBe(error);
  expect(span.setAttribute.mock.calls).toEqual([
    ["db.system.name", "postgresql"],
    ["db.operation.name", "INSERT"],
    ["db.query.text", "insert into users (email) values ($1)"],
    ["error.type", "23505"],
  ]);
});

it("gives a transaction one span, because its queries bypass unsafe", async () => {
  await expect(sql.begin(async () => {})).rejects.toBe(error);
  expect(span.setAttribute).toHaveBeenCalledWith("db.operation.name", "BEGIN");
});
