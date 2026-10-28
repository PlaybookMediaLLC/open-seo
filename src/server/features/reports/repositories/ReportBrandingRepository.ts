import { eq } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  billingCustomerStatus,
  organization,
  organizationBranding,
} from "@/db/schema";
import {
  auditInsert,
  type AuditInput,
} from "@/server/features/activity/auditLog";

// RFC-0007 6.7: one branding row per organization. Every query names the
// organization; there is no other key.

async function get(organizationId: string) {
  const [row] = await db
    .select({
      brandColor: organizationBranding.brandColor,
      logoDataUrl: organizationBranding.logoDataUrl,
    })
    .from(organizationBranding)
    .where(eq(organizationBranding.organizationId, organizationId))
    .limit(1);
  return row ?? null;
}

/** The organization's name, branding and whether it pays, for a shared page. */
async function getForShare(organizationId: string) {
  const [row] = await db
    .select({
      name: organization.name,
      brandColor: organizationBranding.brandColor,
      logoDataUrl: organizationBranding.logoDataUrl,
      isPaying: billingCustomerStatus.isPaying,
    })
    .from(organization)
    .leftJoin(
      organizationBranding,
      eq(organizationBranding.organizationId, organization.id),
    )
    .leftJoin(
      billingCustomerStatus,
      eq(billingCustomerStatus.organizationId, organization.id),
    )
    .where(eq(organization.id, organizationId))
    .limit(1);
  return row ?? null;
}

async function save(input: {
  organizationId: string;
  brandColor: string | null;
  logoDataUrl: string | null;
  updatedByUserId: string;
  audit: AuditInput;
}): Promise<void> {
  const values = {
    brandColor: input.brandColor,
    logoDataUrl: input.logoDataUrl,
    updatedByUserId: input.updatedByUserId,
    updatedAt: new Date().toISOString(),
  };
  await runBatch((tx) => [
    tx
      .insert(organizationBranding)
      .values({ organizationId: input.organizationId, ...values })
      .onConflictDoUpdate({
        target: organizationBranding.organizationId,
        set: values,
      }),
    auditInsert(tx, input.audit),
  ]);
}

async function remove(input: {
  organizationId: string;
  audit: AuditInput;
}): Promise<void> {
  await runBatch((tx) => [
    tx
      .delete(organizationBranding)
      .where(eq(organizationBranding.organizationId, input.organizationId)),
    auditInsert(tx, input.audit),
  ]);
}

export const ReportBrandingRepository = {
  get,
  getForShare,
  save,
  remove,
} as const;
