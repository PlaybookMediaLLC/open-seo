import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { PublishingRepository as repo } from "@/server/features/publishing/repositories/PublishingRepository";
import { fixture } from "@/server/features/publishing/repositories/publishingTestFixtures";
import { auditAfter, type AuditAction } from "./auditLog";
import { auditAuthRoute } from "./authAudit";

// RFC-0009 5.6: proposal, publishing, GitHub App and upstream events.
const database = await vi.hoisted(async () => {
  const { createPublishingTestDatabase } =
    await import("@/server/features/publishing/repositories/publishingTestDb");
  return createPublishingTestDatabase();
});
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
beforeAll(() => database.prepare());
afterAll(() => database.close());

const actionsOf = async (organizationId: string) =>
  (
    await db
      .select({ action: auditEvents.action })
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, organizationId))
  ).map((row) => row.action);
const auditFor = (
  input: { organizationId: string; projectId: string },
  action: AuditAction,
) => ({
  organizationId: input.organizationId,
  projectId: input.projectId,
  actor: { userId: "reviewer" },
  action,
  targetType: "project",
  targetId: input.projectId,
  summary: action,
});

it("records a prepared proposal, and nothing for a refused one", async () => {
  const input = await fixture(database);
  const audit = auditFor(input, "proposal.prepared");
  expect(await repo.saveProposal({ ...input, audit })).toBe(true);
  expect(
    await repo.saveProposal({
      ...input,
      claimToken: "stale",
      proposal: { ...input.proposal, id: crypto.randomUUID() },
      audit,
    }),
  ).toBe(false);
  expect(await actionsOf(input.organizationId)).toEqual(["proposal.prepared"]);
});

it("records connections and one App revocation", async () => {
  const input = await fixture(database);
  await repo.saveInstallation(
    {
      organizationId: input.organizationId,
      installationId: 42,
      accountLogin: "owner",
      accountType: "Organization",
      createdBy: "reviewer",
      createdAt: new Date().toISOString(),
    },
    auditFor(input, "github_app.installed"),
  );
  const [installation] = await repo.listInstallations(input.organizationId);
  const revoke = () =>
    repo.revokeInstallation(
      installation?.id ?? "",
      auditFor(input, "github_app.revoked"),
    );
  await revoke();
  await revoke();
  const disconnect = () =>
    repo.disconnect({
      ...input,
      audit: auditFor(input, "publishing.disconnected"),
    });
  expect(await disconnect()).toBe(true);
  expect(await disconnect()).toBe(false);
  await auditAfter(
    {
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: "owner",
    },
    "integration.gsc_connected",
  );
  const actions = await actionsOf(input.organizationId);
  expect(actions).toHaveLength(4);
  expect(actions).toEqual(
    expect.arrayContaining([
      "github_app.installed",
      "github_app.revoked",
      "integration.gsc_connected",
      "publishing.disconnected",
    ]),
  );
});

it("records a member removal by id, never by the email it names", async () => {
  const input = await fixture(database);
  const hook = (returned: unknown) =>
    auditAuthRoute({
      path: "/organization/remove-member",
      body: { memberIdOrEmail: "teammate@example.com" },
      context: {
        returned,
        session: {
          session: { activeOrganizationId: input.organizationId },
          user: { id: "owner" },
        },
      },
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a minimal better-auth hook context
    } as unknown as Parameters<typeof auditAuthRoute>[0]);
  await hook(new Error("Forbidden"));
  await hook({ member: { id: "member-7" } });
  expect(
    await db
      .select({ action: auditEvents.action, targetId: auditEvents.targetId })
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, input.organizationId)),
  ).toEqual([{ action: "member.removed", targetId: "member-7" }]);
});
