import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  growthNotificationReads,
  growthNotifications,
  member,
  user,
} from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { EmailDigestService, sendDigests } from "./emailDigest";

// RFC-0008 5.11: only opted-in members get a digest, of their own unread
// notifications, at most once a day.
const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
const send = vi.hoisted(() =>
  vi.fn<(message: { to: string; text: string }) => Promise<object>>(),
);
vi.mock("cloudflare:workers", () => ({
  env: {
    DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1",
    EMAIL: { send },
  },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: async () => "https://relay.test",
}));
const HOUR = 3_600_000;

beforeAll(async () => {
  await database.prepare();
  if (!database.isPostgres)
    await database.client.executeMultiple(`
      CREATE TABLE "user" (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, email_verified INTEGER NOT NULL, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, analytics_opted_out INTEGER, terms_accepted_version TEXT, terms_accepted_at INTEGER, product_updates_opt_in INTEGER, product_updates_changed_at INTEGER, last_active_organization_id TEXT);
      CREATE TABLE member (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, created_at INTEGER NOT NULL);
    `);
});
afterAll(() => database.close());
beforeEach(() => {
  send.mockResolvedValue({});
});

async function memberWithNotifications(digest: "daily" | "weekly") {
  const { run } = await setupRun(database.client, database.slugPrefix);
  const organizationId = run.projectId;
  const userId = crypto.randomUUID();
  await db.insert(user).values({
    id: userId,
    name: "Owner",
    email: `${userId}@example.com`,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId,
    userId,
    role: "owner",
    createdAt: new Date(),
  });
  const viewer = { organizationId, userId };
  await EmailDigestService.setDigest(viewer, digest);
  const later = (hours: number) =>
    new Date(Date.now() + hours * HOUR).toISOString();
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  await db.insert(growthNotifications).values(
    ids.map((id, index) => ({
      id,
      organizationId,
      projectId: run.projectId,
      kind: "result_ready" as const,
      title: `Result ${index}`,
      body: "Encouraging",
      linkPath: `/p/${run.projectId}/experiments`,
      dedupeKey: id,
      createdAt: later(1),
    })),
  );
  // The member already read the first one.
  await db.insert(growthNotificationReads).values({
    id: crypto.randomUUID(),
    projectId: run.projectId,
    notificationId: ids[0] ?? "",
    userId,
    readAt: later(1),
  });
  return { viewer, email: `${userId}@example.com` };
}

it("sends each opted-in member their unread notifications, once a day", async () => {
  const { email } = await memberWithNotifications("daily");
  const tomorrow = new Date(Date.now() + 24 * HOUR);
  await sendDigests(tomorrow);
  const sentTo = send.mock.calls.filter(([message]) => message.to === email);
  expect(sentTo).toHaveLength(1);
  expect(sentTo[0]?.[0].text).toContain("Result 1");
  expect(sentTo[0]?.[0].text).not.toContain("Result 0");
  await sendDigests(new Date(tomorrow.getTime() + HOUR));
  expect(
    send.mock.calls.filter(([message]) => message.to === email),
  ).toHaveLength(1);
});

it("sends weekly digests on Mondays only", async () => {
  const { email } = await memberWithNotifications("weekly");
  const sunday = new Date("2026-12-27T08:00:00Z");
  await sendDigests(sunday);
  expect(send.mock.calls.filter(([message]) => message.to === email)).toEqual(
    [],
  );
  await sendDigests(new Date("2026-12-28T08:00:00Z"));
  expect(
    send.mock.calls.filter(([message]) => message.to === email),
  ).toHaveLength(1);
});
