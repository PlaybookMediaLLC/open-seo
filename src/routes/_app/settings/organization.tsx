import { createFileRoute, notFound } from "@tanstack/react-router";
import { AgencyLinksSettings } from "@/client/features/portfolio/AgencyLinksSettings"; // playbook-seam
import { ReportBrandingSettings } from "@/client/features/reports/ReportBrandingSettings"; // playbook-seam
import { TeamSettings } from "@/client/features/team/TeamSettings";
import { usesBetterAuthClient } from "@/lib/auth-mode";

export const Route = createFileRoute("/_app/settings/organization")({
  // Access / no-auth self-host has no memberships or invitations — the
  // better-auth HTTP surface isn't even mounted there.
  beforeLoad: () => {
    if (!usesBetterAuthClient()) {
      throw notFound();
    }
  },
  component: OrganizationSettings, // playbook-seam
});

// playbook-seam: RFC-0007 6.6-6.7, report branding and agency access sit
// under the team.
function OrganizationSettings() {
  return (
    <div className="space-y-10">
      <TeamSettings />
      <ReportBrandingSettings />
      <AgencyLinksSettings />
    </div>
  );
}
