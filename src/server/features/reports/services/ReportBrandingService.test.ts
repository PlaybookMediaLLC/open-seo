import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { db } from "@/db";
import { auditEvents, billingCustomerStatus } from "@/db/schema";
import { setupRun } from "@/server/features/opportunities/repositories/opportunityRepositoryTestSupport";
import { ReportBrandingService } from "./ReportBrandingService";

// RFC-0007 6.7: only owners and admins change an organization's shared-report
// branding, a change reaches only their organization, and the Relay mark
// comes off only for a branded organization that pays.
const database = await vi.hoisted(async () => {
  const { createExperimentTestDatabase } =
    await import("@/server/features/experiments/repositories/experimentTestDb");
  return createExperimentTestDatabase();
});
vi.mock("cloudflare:workers", () => ({
  env: {
    DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1",
    AUTH_MODE: "hosted",
  },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
beforeAll(async () => {
  await database.prepare();
  if (!database.isPostgres)
    await database.client.executeMultiple(
      "CREATE TABLE billing_customer_status (organization_id TEXT PRIMARY KEY, is_paying INTEGER NOT NULL DEFAULT 0, paid_plan_id TEXT, paid_plan_status TEXT, customer_json TEXT NOT NULL, synced_at TEXT NOT NULL, created_at TEXT, updated_at TEXT);",
    );
});
afterAll(() => database.close());

// A 1x1 PNG.
const LOGO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==";

async function organization() {
  const { run } = await setupRun(database.client, database.slugPrefix);
  const as = (role: string) => ({
    organizationId: run.projectId,
    userId: `${role}-${run.projectId}`,
    role,
  });
  return { id: run.projectId, admin: as("admin"), member: as("member") };
}

const brandingOf = async (organizationId: string) =>
  (await ReportBrandingService.forShare(organizationId))?.branding;

const changes = (organizationId: string) =>
  db
    .select({ id: auditEvents.id })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.organizationId, organizationId),
        eq(auditEvents.action, "branding.changed"),
      ),
    );

it("lets only owners and admins change branding, and only their own organization's", async () => {
  const x = await organization();
  const y = await organization();
  const branding = { brandColor: "#1c4ed8", logoDataUrl: LOGO };
  await expect(
    ReportBrandingService.save(x.member, branding),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(await brandingOf(x.id)).toBeNull();

  await ReportBrandingService.save(x.admin, branding);
  await ReportBrandingService.save(y.admin, {
    brandColor: "#0f766e",
    logoDataUrl: null,
  });
  expect(await brandingOf(x.id)).toEqual(branding);
  expect(await brandingOf(y.id)).toEqual({
    brandColor: "#0f766e",
    logoDataUrl: null,
  });

  await expect(ReportBrandingService.remove(x.member)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await ReportBrandingService.remove(x.admin);
  expect(await brandingOf(x.id)).toBeNull();
  expect(await brandingOf(y.id)).toEqual({
    brandColor: "#0f766e",
    logoDataUrl: null,
  });
  expect(await changes(x.id)).toHaveLength(2);
  expect(await changes(y.id)).toHaveLength(1);
});

it("removes the Relay mark only for a branded organization that pays", async () => {
  const paying = await organization();
  const free = await organization();
  const unbranded = await organization();
  for (const org of [paying, unbranded])
    await db.insert(billingCustomerStatus).values({
      organizationId: org.id,
      isPaying: true,
      customerJson: "{}",
      syncedAt: new Date().toISOString(),
    });
  for (const org of [paying, free])
    await ReportBrandingService.save(org.admin, {
      brandColor: "#1c4ed8",
      logoDataUrl: null,
    });
  const marks = async (organizationId: string) =>
    (await ReportBrandingService.forShare(organizationId))?.hideRelayMark;
  expect(await marks(paying.id)).toBe(true);
  expect(await marks(free.id)).toBe(false);
  expect(await marks(unbranded.id)).toBe(false);
});
