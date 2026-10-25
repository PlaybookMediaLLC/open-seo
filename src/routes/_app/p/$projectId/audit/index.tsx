import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { auditSearchSchema } from "@/types/schemas/audit";
import { LaunchView } from "@/client/features/audit/launch/LaunchView";
import { AuditDetail } from "@/client/features/audit/AuditDetail";

export const Route = createFileRoute("/_app/p/$projectId/audit/")({
  validateSearch: auditSearchSchema,
  component: SiteAuditPage,
});

function SiteAuditPage() {
  const { projectId } = Route.useParams();
  const { auditId, tab, url, view } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const setSearchParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      void navigate({
        search: (prev) => ({ ...prev, ...updates }),
        replace: true,
      });
    },
    [navigate],
  );

  const showHistory = () =>
    setSearchParams({ auditId: undefined, url: undefined, view: "history" });

  if (!auditId) {
    return (
      <LaunchView
        projectId={projectId}
        initialUrl={url ?? ""}
        showHistory={view === "history"}
        onShowHistory={showHistory}
        onAuditStarted={(id) =>
          setSearchParams({ auditId: id, url: undefined, view: undefined })
        }
      />
    );
  }

  return (
    <AuditDetail
      projectId={projectId}
      auditId={auditId}
      tab={tab}
      onBack={showHistory}
      onTabChange={(nextTab) => setSearchParams({ tab: nextTab })}
    />
  );
}
