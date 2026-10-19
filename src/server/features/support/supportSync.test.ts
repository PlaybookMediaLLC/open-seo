import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  supportSources,
  supportTopicExcerpts,
  supportTopics,
} from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { processSupportTickets } from "./supportSync";

// RFC-0017 5.4 and 6.1: ticket text is redacted, processed in memory and
// never stored; only labels, counts and short redacted excerpts remain.
const database = await vi.hoisted(async () => {
  const { createOpportunityTestDatabase } =
    await import("@/server/features/opportunities/repositories/opportunityRepositoryTestDb");
  return createOpportunityTestDatabase("support-sync-test-");
});
const mocks = vi.hoisted(() => ({ switch: "on", requests: 0 }));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: async (name: string) =>
    name === "RELAY_SUPPORT_TOPICS" ? mocks.switch : undefined,
}));
vi.mock(
  "@/server/features/publishing/repositories/PublishingRepository",
  () => ({ PublishingRepository: { getConnection: async () => ({}) } }),
);
// A login ticket points one way, a billing ticket the other.
vi.mock("./supportEmbeddings", () => ({
  embedTexts: async (_: unknown, values: string[]) =>
    values.map((value) => (/login/i.test(value) ? [1, 0] : [0, 1])),
}));
const PERSONAL = [
  "grace@example.com",
  "+1 415 555 0100",
  "hopper-g",
  "secret body text",
];
const issue = (title: string, day: string, extra = {}) => ({
  title,
  body: `Hi, I am ${PERSONAL[2]}, mail ${PERSONAL[0]} or call ${PERSONAL[1]}. ${PERSONAL[3]}`,
  created_at: `${day}T00:00:00Z`,
  user: { login: PERSONAL[2] },
  ...extra,
});
vi.mock("@/server/features/publishing/publishingAccess", () => ({
  connectedGithub: async () => ({
    request: async () => {
      mocks.requests++;
      return [
        ...Array.from({ length: 10 }, (_, index) =>
          issue(`Login fails for hopper-g #${index}`, "2026-10-10"),
        ),
        issue("Login fails again", "2026-09-10"),
        issue("Invoice is wrong", "2026-10-11"),
        issue("Login PR", "2026-10-12", { pull_request: {} }),
      ];
    },
  }),
}));

const NOW = new Date("2026-10-19T00:00:00Z");
const customer = { organizationId: "o", userId: "u", userEmail: "e@x.io" };

beforeAll(() => database.prepare());
afterAll(() => database.close());
beforeEach(() => {
  mocks.switch = "on";
  mocks.requests = 0;
});

async function connected() {
  const { run } = await setupRun(database.client, "support-sync-test-");
  await db.insert(supportSources).values({
    id: crypto.randomUUID(),
    projectId: run.projectId,
    provider: "github_issues",
    createdBy: "owner",
    createdAt: NOW.toISOString(),
  });
  return run.projectId;
}

it("does nothing while the server switch is off", async () => {
  mocks.switch = "";
  expect(await processSupportTickets(await connected(), NOW, customer)).toEqual(
    {
      status: "off",
    },
  );
  expect(mocks.requests).toBe(0);
});

it("stores counted topics and redacted excerpts, and no ticket text", async () => {
  const projectId = await connected();
  expect(await processSupportTickets(projectId, NOW, customer)).toEqual({
    status: "processed",
    tickets: 12,
    topics: 2,
  });
  const topics = await db
    .select()
    .from(supportTopics)
    .where(eq(supportTopics.projectId, projectId));
  expect(
    topics.map((topic) => [
      topic.label,
      topic.ticketCount28d,
      topic.ticketCountPrev28d,
    ]),
  ).toEqual(
    expect.arrayContaining([
      ["fails login again", 10, 1],
      ["invoice wrong", 1, 0],
    ]),
  );
  const excerpts = await db
    .select()
    .from(supportTopicExcerpts)
    .where(eq(supportTopicExcerpts.projectId, projectId));
  expect(excerpts.length).toBeLessThanOrEqual(6);
  expect(excerpts.every((excerpt) => excerpt.text.length <= 200)).toBe(true);
  const stored = JSON.stringify([topics, excerpts]);
  for (const value of PERSONAL) expect(stored).not.toContain(value);
});
