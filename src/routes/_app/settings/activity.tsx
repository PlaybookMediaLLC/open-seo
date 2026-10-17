import { createFileRoute, notFound } from "@tanstack/react-router";
import { ActivityLog } from "@/client/features/activity/ActivityLog";
import { isHostedClientAuthMode } from "@/lib/auth-mode";

// RFC-0009 5.6: the organization's audit events, for owners and admins.
export const Route = createFileRoute("/_app/settings/activity")({
  beforeLoad: () => {
    if (!isHostedClientAuthMode()) throw notFound();
  },
  component: ActivityLog,
});
