import {
  hasOrgPermission,
  type OrgPermissionRequest,
} from "@/lib/org-permissions";
import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { ReportBrandingRepository } from "@/server/features/reports/repositories/ReportBrandingRepository";
import { isHostedServerAuthMode } from "@/server/lib/runtime-env";
import {
  brandColorSchema,
  logoDataUrlSchema,
  type SaveReportBrandingInput,
} from "@/shared/report-branding";

// RFC-0007 6.7: white-label shared reports. An organization's logo and color
// show on its shared report pages; the Relay mark comes off only for an
// organization on a paid plan (self-hosted deployments have no plans).
type BrandingContext = Pick<
  EnsuredUserContext,
  "organizationId" | "userId" | "role"
>;

const MANAGE: OrgPermissionRequest = { organization: ["update"] };

type Branding = { brandColor: string | null; logoDataUrl: string | null };

// Stored values are checked again on read: better to drop a bad logo than to
// put it on a public page.
function checked(row: Branding | null): Branding | null {
  if (!row) return null;
  const color = brandColorSchema.safeParse(row.brandColor);
  const logo = logoDataUrlSchema.safeParse(row.logoDataUrl);
  const branding = {
    brandColor: color.success ? color.data : null,
    logoDataUrl: logo.success ? logo.data : null,
  };
  return branding.brandColor || branding.logoDataUrl ? branding : null;
}

async function removesRelayMark(isPaying: boolean | null): Promise<boolean> {
  return !(await isHostedServerAuthMode()) || isPaying === true;
}

async function get(context: BrandingContext): Promise<{
  canManage: boolean;
  branding: Branding | null;
  removesRelayMark: boolean;
}> {
  const share = await ReportBrandingRepository.getForShare(
    context.organizationId,
  );
  return {
    canManage: hasOrgPermission(context.role, MANAGE),
    branding: checked(share),
    removesRelayMark: await removesRelayMark(share?.isPaying ?? null),
  };
}

async function save(
  context: BrandingContext,
  input: SaveReportBrandingInput,
): Promise<void> {
  requireOrgPermission(context, MANAGE);
  await ReportBrandingRepository.save({
    organizationId: context.organizationId,
    brandColor: input.brandColor,
    logoDataUrl: input.logoDataUrl,
    updatedByUserId: context.userId,
    audit: {
      organizationId: context.organizationId,
      projectId: null,
      actor: context,
      action: "branding.changed",
      targetType: "organization",
      targetId: context.organizationId,
      summary: "Changed the branding of shared reports",
    },
  });
}

async function remove(context: BrandingContext): Promise<void> {
  requireOrgPermission(context, MANAGE);
  if (!(await ReportBrandingRepository.get(context.organizationId))) return;
  await ReportBrandingRepository.remove({
    organizationId: context.organizationId,
    audit: {
      organizationId: context.organizationId,
      projectId: null,
      actor: context,
      action: "branding.changed",
      targetType: "organization",
      targetId: context.organizationId,
      summary: "Removed the branding of shared reports",
    },
  });
}

/**
 * What a public share page of this organization shows. The caller already
 * resolved the organization from a valid share token.
 */
async function forShare(organizationId: string): Promise<{
  organizationName: string;
  branding: Branding | null;
  hideRelayMark: boolean;
} | null> {
  const share = await ReportBrandingRepository.getForShare(organizationId);
  if (!share) return null;
  const branding = checked(share);
  return {
    organizationName: share.name,
    branding,
    // White-label is opt-in: without branding the page keeps the Relay mark.
    hideRelayMark:
      branding !== null && (await removesRelayMark(share.isPaying)),
  };
}

/** The color agents use as a report's accent (RFC-0007 6.7). */
async function brandColor(organizationId: string): Promise<string | null> {
  return (
    checked(await ReportBrandingRepository.get(organizationId))?.brandColor ??
    null
  );
}

export const ReportBrandingService = {
  get,
  save,
  remove,
  forShare,
  brandColor,
};
