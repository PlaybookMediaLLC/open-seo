import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { revenueConnections, revenueEvents } from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { encryptToken } from "@/server/features/publishing/tokenKeys";
import { syncRevenue } from "./revenueSync";

// RFC-0016 5.4: Stripe fixtures with personal fields, which must never reach
// the database.
const database = await vi.hoisted(async () => {
  const { createOpportunityTestDatabase } =
    await import("@/server/features/opportunities/repositories/opportunityRepositoryTestDb");
  return createOpportunityTestDatabase("revenue-sync-test-");
});
const stripe = vi.hoisted(() => ({
  invoices: [] as Array<Record<string, unknown>>,
  refunds: [] as Array<Record<string, unknown>>,
  calls: [] as string[],
}));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: async (name: string) =>
    name === "BETTER_AUTH_SECRET"
      ? "revenue-test-secret-of-at-least-32-characters"
      : undefined,
}));

const NOW = new Date("2026-10-19T00:00:00Z");
const at = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const PERSONAL = ["Ada Lovelace", "ada@example.com", "12 Analytical Way"];

/** A Stripe list endpoint: the window's items, 100 at a time. */
function list(items: Array<Record<string, unknown>>, query: URLSearchParams) {
  const from = Number(query.get("created[gte]"));
  const to = Number(query.get("created[lt]"));
  const inWindow = items.filter(
    (item) => Number(item.created) >= from && Number(item.created) < to,
  );
  const after = query.get("starting_after");
  const start = after ? inWindow.findIndex((item) => item.id === after) + 1 : 0;
  const data = inWindow.slice(start, start + 100);
  return Response.json({ data, has_more: start + 100 < inWindow.length });
}

beforeAll(async () => {
  await database.prepare();
  vi.stubGlobal("fetch", async (input: string) => {
    const url = new URL(input);
    stripe.calls.push(url.pathname);
    if (url.pathname === "/v1/invoices")
      return list(stripe.invoices, url.searchParams);
    if (url.pathname === "/v1/refunds")
      return list(stripe.refunds, url.searchParams);
    if (url.pathname === "/v1/checkout/sessions")
      return Response.json({
        data:
          url.searchParams.get("customer") === "cus_email"
            ? [
                {
                  id: "cs_1",
                  metadata: {
                    relay_ft_at: "2026-10-01T00:00:00.000Z",
                    relay_ft_path: "/guide",
                    relay_ft_medium: "email",
                  },
                },
              ]
            : [],
        has_more: false,
      });
    if (url.pathname.startsWith("/v1/customers/"))
      return Response.json({
        metadata: {},
        name: PERSONAL[0],
        email: PERSONAL[1],
      });
    return new Response("{}", { status: 404 });
  });
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await database.close();
});
beforeEach(() => {
  stripe.invoices = [];
  stripe.refunds = [];
  stripe.calls = [];
});

async function connected() {
  const { run } = await setupRun(database.client, "revenue-sync-test-");
  const { encryptedToken, tokenKeyVersion } = await encryptToken(
    "rk_test_51AbCdEfGhIjKlMnOpQr",
  );
  await db.insert(revenueConnections).values({
    id: crypto.randomUUID(),
    projectId: run.projectId,
    provider: "stripe",
    encryptedKey: encryptedToken,
    keyVersion: tokenKeyVersion,
    hashSalt: "salt",
    livemode: false,
    syncCursor: at("2026-10-01T00:00:00Z"),
    createdBy: "owner",
    createdAt: NOW.toISOString(),
  });
  return run.projectId;
}
const invoice = (
  id: string,
  customer: string,
  created: string,
  extra = {},
) => ({
  id,
  customer,
  created: at(created),
  billing_reason: "subscription_create",
  amount_paid: 4_900,
  currency: "usd",
  customer_name: PERSONAL[0],
  customer_email: PERSONAL[1],
  customer_address: { line1: PERSONAL[2] },
  ...extra,
});

it("stores each payment once with its first touch, and no personal field", async () => {
  const projectId = await connected();
  stripe.invoices = [
    invoice("in_search", "cus_search", "2026-10-10T00:00:00Z", {
      subscription_details: {
        metadata: {
          relay_ft_at: "2026-10-02T00:00:00.000Z",
          relay_ft_path: "/pricing",
          relay_ft_referrer: "www.google.com",
        },
      },
    }),
    invoice("in_email", "cus_email", "2026-10-11T00:00:00Z", {
      billing_reason: "subscription_cycle",
    }),
    invoice("in_none", "cus_none", "2026-10-12T00:00:00Z", {
      billing_reason: "manual",
    }),
  ];
  stripe.refunds = [
    {
      id: "re_1",
      amount: 4_900,
      currency: "usd",
      created: at("2026-10-15T00:00:00Z"),
      status: "succeeded",
      charge: {
        customer: "cus_search",
        invoice: "in_search",
        billing_details: { email: PERSONAL[1] },
      },
    },
  ];
  expect(await syncRevenue(projectId, NOW)).toMatchObject({
    invoices: 3,
    rows: 4,
    complete: true,
    refundsSkipped: false,
  });
  // A second run finds the same payments and adds no row.
  await syncRevenue(projectId, NOW);
  const rows = await db
    .select()
    .from(revenueEvents)
    .where(eq(revenueEvents.projectId, projectId));
  expect(rows).toHaveLength(4);
  expect(
    rows.map((row) => [row.kind, row.amountMinor, row.ftChannel, row.ftPath]),
  ).toEqual(
    expect.arrayContaining([
      ["first_payment", 4_900, "organic_search", "/pricing"],
      ["renewal", 4_900, "email", "/guide"],
      ["one_time", 4_900, "unknown", null],
      ["refund", -4_900, "organic_search", "/pricing"],
    ]),
  );
  const stored = JSON.stringify(rows);
  for (const value of [...PERSONAL, "cus_search", "in_search"])
    expect(stored).not.toContain(value);
});

it("stops at the first window boundary after 5,000 invoices", async () => {
  const projectId = await connected();
  stripe.invoices = Array.from({ length: 5_001 }, (_, index) =>
    invoice(`in_${index}`, "cus_none", "2026-09-26T00:00:00Z"),
  );
  stripe.invoices.push(invoice("in_late", "cus_none", "2026-10-10T00:00:00Z"));
  const result = await syncRevenue(projectId, NOW);
  expect(result).toMatchObject({ invoices: 5_001, complete: false });
  const [connection] = await db
    .select({ cursor: revenueConnections.syncCursor })
    .from(revenueConnections)
    .where(eq(revenueConnections.projectId, projectId));
  // The 7-day window that started a week before the cursor is done.
  expect(connection?.cursor).toBe(at("2026-10-01T00:00:00Z"));
});
