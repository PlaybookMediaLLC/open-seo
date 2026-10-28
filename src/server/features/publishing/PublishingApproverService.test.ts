import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { db } from "@/db";
import { auditEvents, member, user } from "@/db/schema";
import {
  refuseApproverChange,
  setMemberApproval,
} from "@/server/auth/member-approval";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { MetadataExecutionService } from "./MetadataExecutionService";
import { PublishingApproverService } from "./PublishingApproverService";

// RFC-0007 6.4-6.5: owners always approve pull requests; other members need
// the approver role, until a project lists its approvers.
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
const userIds: string[] = [];
beforeAll(async () => {
  await database.prepare();
  if (!database.isPostgres)
    // The real project lookup selects every column of the full table.
    await database.client.executeMultiple(`
      ALTER TABLE projects ADD COLUMN domain TEXT;
      ALTER TABLE projects ADD COLUMN location_code INTEGER DEFAULT 2840;
      ALTER TABLE projects ADD COLUMN language_code TEXT DEFAULT 'en';
      ALTER TABLE projects ADD COLUMN created_at TEXT;
      ALTER TABLE projects ADD COLUMN ai_research_keywords TEXT;
    `);
});
afterAll(async () => {
  for (const id of userIds) await db.delete(user).where(eq(user.id, id));
  await database.close();
});

async function organization() {
  const { run } = await setupRun(database.client, database.slugPrefix);
  const organizationId = run.projectId;
  const join = async (role: string) => {
    const userId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    userIds.push(userId);
    await db.insert(user).values({
      id: userId,
      name: role,
      email: `${userId}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(member).values({
      id: memberId,
      organizationId,
      userId,
      role,
      createdAt: new Date(),
    });
    return { memberId, context: { organizationId, userId, role } };
  };
  return {
    projectId: run.projectId,
    owner: await join("owner"),
    admin: await join("admin"),
    approver: await join("admin,approver"),
  };
}

const approves = async (
  context: { organizationId: string; userId: string; role: string },
  projectId: string,
) => (await PublishingApproverService.list(context, projectId)).canApprove;

it("narrows approval to a project's listed members, and back", async () => {
  const { projectId, owner, admin, approver } = await organization();
  expect(await approves(owner.context, projectId)).toBe(true);
  expect(await approves(admin.context, projectId)).toBe(false);
  expect(await approves(approver.context, projectId)).toBe(true);

  await PublishingApproverService.save(owner.context, {
    projectId,
    memberIds: [admin.memberId],
  });
  expect(await approves(owner.context, projectId)).toBe(true);
  expect(await approves(admin.context, projectId)).toBe(true);
  expect(await approves(approver.context, projectId)).toBe(false);

  await PublishingApproverService.save(owner.context, {
    projectId,
    memberIds: [],
  });
  expect(await approves(admin.context, projectId)).toBe(false);
  expect(await approves(approver.context, projectId)).toBe(true);
});

it("refuses a pull request from a member who may not approve, before any GitHub work", async () => {
  const { projectId, admin } = await organization();
  await expect(
    MetadataExecutionService.execute(admin.context, {
      projectId,
      proposalId: "proposal",
      changeHash: "a".repeat(64),
      authorizePullRequest: true,
      note: "",
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("lets only an owner list approvers, and only managers of this organization", async () => {
  const { projectId, owner, approver } = await organization();
  const other = await organization();
  const changes = () =>
    db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.projectId, projectId),
          eq(auditEvents.action, "publishing.approvers_changed"),
        ),
      );
  await expect(
    PublishingApproverService.save(approver.context, {
      projectId,
      memberIds: [approver.memberId],
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    PublishingApproverService.save(owner.context, {
      projectId,
      memberIds: [other.admin.memberId],
    }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  await db
    .update(member)
    .set({ role: "member" })
    .where(eq(member.id, approver.memberId));
  await expect(
    PublishingApproverService.save(owner.context, {
      projectId,
      memberIds: [approver.memberId],
    }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

  const save = () =>
    PublishingApproverService.save(owner.context, {
      projectId,
      memberIds: [owner.memberId],
    });
  await save();
  await save();
  expect(await changes()).toHaveLength(1);
});

it("lets only an owner grant or remove a member's approval", async () => {
  const { projectId, owner, admin, approver } = await organization();
  await expect(
    setMemberApproval(approver.context, {
      memberId: admin.memberId,
      approve: true,
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    setMemberApproval(owner.context, {
      memberId: owner.memberId,
      approve: false,
    }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

  await setMemberApproval(owner.context, {
    memberId: admin.memberId,
    approve: true,
  });
  const promoted = { ...admin.context, role: "admin,approver" };
  expect(await approves(promoted, projectId)).toBe(true);
  await setMemberApproval(owner.context, {
    memberId: admin.memberId,
    approve: false,
  });
  const [row] = await db
    .select({ role: member.role })
    .from(member)
    .where(eq(member.id, admin.memberId));
  expect(row?.role).toBe("admin");
  const events = await db
    .select({ action: auditEvents.action })
    .from(auditEvents)
    .where(eq(auditEvents.targetId, admin.memberId));
  expect(events.map((event) => event.action)).toHaveLength(2);
  expect(events.map((event) => event.action)).toEqual(
    expect.arrayContaining([
      "member.approval_granted",
      "member.approval_removed",
    ]),
  );
});

it("keeps better-auth's role endpoint from adding or removing approval", () => {
  expect(() => refuseApproverChange("admin", "admin,approver")).toThrow();
  expect(() => refuseApproverChange("admin,approver", "member")).toThrow();
  expect(() => refuseApproverChange("admin", "member")).not.toThrow();
  expect(() =>
    refuseApproverChange("admin,approver", "member,approver"),
  ).not.toThrow();
});
