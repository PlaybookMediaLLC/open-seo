import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { NotificationService } from "./NotificationService";
import { GrowthJobRepository } from "./repositories/GrowthJobRepository";

const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
beforeAll(() => database.prepare());
afterAll(() => database.close());

async function organizationWithProject() {
  const id = crypto.randomUUID();
  await database.client.execute({
    sql: "INSERT INTO organization (id, name, slug, created_at) VALUES (?, 'test', ?, CURRENT_TIMESTAMP)",
    args: [id, `${database.slugPrefix}${id}`],
  });
  await database.client.execute({
    sql: "INSERT INTO projects (id, organization_id, name) VALUES (?, ?, 'test')",
    args: [id, id],
  });
  const notify = (dedupeKey: string) =>
    GrowthJobRepository.notify({
      organizationId: id,
      projectId: id,
      kind: "result_ready",
      title: `Result ${dedupeKey}`,
      body: "Done.",
      linkPath: `/p/${id}/experiments`,
      dedupeKey,
    });
  return { id, notify };
}

it("keeps each member's read state, once per notification, inside the organization", async () => {
  const mine = await organizationWithProject();
  const other = await organizationWithProject();
  await mine.notify("a");
  await mine.notify("a");
  await mine.notify("b");
  await other.notify("c");
  const alice = { organizationId: mine.id, userId: "alice" };
  const bob = { organizationId: mine.id, userId: "bob" };
  const listed = await NotificationService.list(alice);
  expect(new Set(listed.items.map((item) => item.title))).toEqual(
    new Set(["Result a", "Result b"]),
  );
  expect(listed.unread).toBe(2);
  await NotificationService.markAllRead(alice);
  await NotificationService.markAllRead(alice);
  expect((await NotificationService.list(alice)).unread).toBe(0);
  expect((await NotificationService.list(bob)).unread).toBe(2);
});
