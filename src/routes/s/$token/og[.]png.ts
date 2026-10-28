import { createFileRoute } from "@tanstack/react-router";
import { ReportRepository } from "@/server/features/reports/repositories/ReportRepository";
import { ReportBrandingService } from "@/server/features/reports/services/ReportBrandingService"; // playbook-seam
import {
  SHARE_TOKEN_PATTERN,
  sharesEnabled,
} from "@/server/features/reports/shareAccess";
import { textResponse } from "@/shared/report-sandbox";

export async function handleReportSocialImage(
  token: string,
): Promise<Response> {
  if (!(await sharesEnabled()) || !SHARE_TOKEN_PATTERN.test(token)) {
    return textResponse("This report isn't shared.", 404);
  }
  const report = await ReportRepository.getSharedReportByToken(token);
  if (!report || report.archived) {
    return textResponse("This report isn't shared.", 404);
  }

  // Keep the renderer and WASM out of the app's eager startup graph, and do
  // not initialize either for invalid, revoked, or archived shares.
  try {
    const { renderReportSocialImage } =
      await import("@/server/features/reports/reportSocialImage");
    // playbook-seam: RFC-0007 6.7, no Relay mark on a white-label card.
    const brand = await ReportBrandingService.forShare(report.organizationId);
    return await renderReportSocialImage(
      report.title,
      report.projectDomain,
      brand?.hideRelayMark
        ? {
            name: brand.organizationName,
            logo: brand.branding?.logoDataUrl ?? null,
          }
        : null,
    );
  } catch (error) {
    console.error("Report social image rendering failed", error);
    return new Response(null, {
      status: 302,
      headers: {
        Location: "https://openseo.so/social-card.jpg",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
}

export const Route = createFileRoute("/s/$token/og.png")({
  server: {
    handlers: {
      GET: ({ params }) => handleReportSocialImage(params.token),
    },
  },
});
