import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/db";
import { auditEvents, member, spendLedger, user } from "@/db/schema";
import { DashboardSiteService } from "@/server/features/dashboard/services/DashboardSiteService";
import { deployed } from "@/server/features/experiments/repositories/experimentTestFixtures";
import { listProjects } from "@/server/features/projects/services/projects";
import { AgencyLinkService } from "./AgencyLinkService";
import { PortfolioService } from "./PortfolioService";

// RFC-0007 6.1, 6.2 and 6.6: the portfolio reads each project's own tables,
// and a client organization's only after its owner accepts the agency.
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
// The project list and the stored Search Console rows have their own tests.
vi.mock("@/server/features/projects/services/projects", () => ({
  listProjects: vi.fn(),
}));
vi.mock("@/server/features/dashboard/services/DashboardSiteService", () => ({
  DashboardSiteService: { getCachedKeywords: vi.fn() },
}));

const projectsOf = new Map<string, string[]>();
const userIds: string[] = [];
beforeAll(() => database.prepare());
afterAll(async () => {
  if (userIds.length) await db.delete(user).where(inArray(user.id, userIds));
  await database.close();
});
beforeEach(() => {
  vi.mocked(listProjects).mockImplementation(async (organizationId) =>
    (projectsOf.get(organizationId) ?? []).map((id) => ({
      id,
      name: `site ${id.slice(0, 4)}`,
      domain: "example.com",
      locationCode: 2840,
      languageCode: "en",
      createdAt: "2026-10-01",
    })),
  );
  vi.mocked(DashboardSiteService.getCachedKeywords).mockResolvedValue({
    connected: false,
    cached: null,
  });
});

/** An organization with one project that has an open opportunity and a measuring experiment. */
async function site() {
  const { input } = await deployed(database);
  projectsOf.set(input.organizationId, [input.projectId]);
  return { organizationId: input.organizationId, projectId: input.projectId };
}

async function addMember(organizationId: string, userId: string, role: string) {
  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId,
    userId,
    role,
    createdAt: new Date(),
  });
  return { organizationId, userId, role };
}

async function join(organizationId: string, role: string) {
  const userId = crypto.randomUUID();
  userIds.push(userId);
  await db.insert(user).values({
    id: userId,
    name: role,
    email: `${userId}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return addMember(organizationId, userId, role);
}

it("summarizes each project from its own opportunities, experiments and spend", async () => {
  const { organizationId, projectId } = await site();
  await db.insert(spendLedger).values({
    id: crypto.randomUUID(),
    organizationId,
    projectId,
    feature: "keyword_research",
    provider: "dataforseo",
    actor: "owner",
    periodMonth: new Date().toISOString().slice(0, 7),
    estimatedCredits: 40,
    actualCredits: 25,
    status: "settled",
    idempotencyKey: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
  const portfolio = await PortfolioService.summary({ organizationId });
  expect(portfolio.committed).toBe(25);
  expect(portfolio.clients).toEqual([]);
  expect(portfolio.projects).toEqual([
    expect.objectContaining({
      id: projectId,
      openOpportunities: 1,
      opportunitiesByType: { striking_distance: 1 },
      experiments: {
        encouraging: 0,
        inconclusive: 0,
        negative: 0,
        measuring: 1,
      },
      spend: { committed: 25, limit: null },
      search: { status: "not_connected" },
    }),
  ]);
});

// A stored dashboard entry whose 28-day window ends on endDate.
const stored = (endDate: string) => ({
  connected: true as const,
  cached: {
    fetchedAt: `${endDate}T06:00:00.000Z`,
    value: {
      connected: true,
      startDate: "2026-09-22",
      endDate,
      rows: [
        { query: "a", clicks: 3, impressions: 40, position: 4 },
        { query: "b", clicks: 2, impressions: 60, position: 9 },
      ],
    },
  },
});

it("compares stored Search Console totals and marks a project whose dates differ", async () => {
  const organizationId = crypto.randomUUID();
  projectsOf.set(organizationId, ["current", "older", "unloaded"]);
  vi.mocked(DashboardSiteService.getCachedKeywords).mockImplementation(
    async (projectId) =>
      projectId === "unloaded"
        ? { connected: true, cached: null }
        : stored(projectId === "current" ? "2026-10-19" : "2026-10-18"),
  );
  const { projects } = await PortfolioService.summary({ organizationId });
  expect(projects.map((project) => project.search)).toEqual([
    expect.objectContaining({
      status: "loaded",
      clicks: 5,
      impressions: 100,
      sameDates: true,
    }),
    expect.objectContaining({ status: "loaded", sameDates: false }),
    { status: "not_loaded" },
  ]);
});

it("shows a client's summary to its agency only while the client's owner allows it", async () => {
  const agency = await site();
  const client = await site();
  const agencyOwner = await join(agency.organizationId, "owner");
  const inClient = await addMember(
    client.organizationId,
    agencyOwner.userId,
    "admin",
  );
  const clientOwner = await join(client.organizationId, "owner");
  const clientsOf = async () =>
    (await PortfolioService.summary(agency)).clients.map(
      (row) => row.organizationId,
    );

  const { linkId } = await AgencyLinkService.request(agencyOwner, {
    clientOrganizationId: client.organizationId,
  });
  await expect(
    AgencyLinkService.request(agencyOwner, {
      clientOrganizationId: client.organizationId,
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(await clientsOf()).toEqual([]);

  // Only the client's owner accepts, and only from the client organization.
  await expect(
    AgencyLinkService.accept(inClient, { linkId }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    AgencyLinkService.accept(agencyOwner, { linkId }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await AgencyLinkService.accept(clientOwner, { linkId });
  expect(await clientsOf()).toEqual([client.organizationId]);
  expect((await PortfolioService.summary(client)).clients).toEqual([]);

  await AgencyLinkService.end(clientOwner, { linkId });
  expect(await clientsOf()).toEqual([]);
  const events = await db
    .select({ organizationId: auditEvents.organizationId })
    .from(auditEvents)
    .where(eq(auditEvents.targetId, linkId));
  expect(
    events.filter((row) => row.organizationId === agency.organizationId),
  ).toHaveLength(3);
  expect(
    events.filter((row) => row.organizationId === client.organizationId),
  ).toHaveLength(3);
});

it("refuses a request for an organization the owner does not belong to", async () => {
  const agency = await site();
  const stranger = await site();
  const agencyOwner = await join(agency.organizationId, "owner");
  await expect(
    AgencyLinkService.request(agencyOwner, {
      clientOrganizationId: stranger.organizationId,
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    AgencyLinkService.request(
      { ...agencyOwner, role: "admin" },
      { clientOrganizationId: stranger.organizationId },
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
