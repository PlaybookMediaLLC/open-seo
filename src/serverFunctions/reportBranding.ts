import { createServerFn } from "@tanstack/react-start";
import { ReportBrandingService } from "@/server/features/reports/services/ReportBrandingService";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
import { saveReportBrandingInputSchema } from "@/shared/report-branding";

// RFC-0007 6.7: the organization's shared-report branding.
export const getReportBranding = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(({ context }) => ReportBrandingService.get(context));

export const saveReportBranding = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(saveReportBrandingInputSchema)
  .handler(({ context, data }) => ReportBrandingService.save(context, data));

export const removeReportBranding = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(({ context }) => ReportBrandingService.remove(context));
