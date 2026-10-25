import { useState } from "react";
import { AuditDetail } from "../AuditDetail";
import { ProjectResearchTarget } from "@/client/components/ProjectResearchTarget";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { AuditHistorySection } from "@/client/features/audit/launch/AuditHistorySection";
import { LaunchFormCard } from "@/client/features/audit/launch/LaunchFormCard";
import { useLaunchController } from "@/client/features/audit/launch/useLaunchController";
import { useHostedPlanGate } from "@/client/features/billing/HostedPlanGate";

type LaunchViewProps = {
  projectId: string;
  initialUrl: string;
  onAuditStarted: (auditId: string) => void;
};

export function LaunchView({
  projectId,
  initialUrl,
  onAuditStarted,
}: LaunchViewProps) {
  // The plan only sets the page limit, so the form stays usable while the
  // plan loads. The server enforces the limit regardless.
  const isFreePlan = useHostedPlanGate() === "free";
  const controller = useLaunchController({
    projectId,
    initialUrl,
    isFreePlan,
    onAuditStarted,
  });

  const [showHistory, setShowHistory] = useState(false);
  const [tab, setTab] = useState<"issues" | "pages" | "performance">("issues");
  const latest = controller.historyQuery.data?.find(
    (audit) => audit.status === "completed",
  );
  if (latest && !initialUrl && !showHistory) {
    return (
      <AuditDetail
        projectId={projectId}
        auditId={latest.id}
        tab={tab}
        onTabChange={setTab}
        onBack={() => setShowHistory(true)}
      />
    );
  }

  return (
    <div className="page-pad overflow-auto">
      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader title="Site Audit" />

        <AuditHistorySection
          projectId={projectId}
          historyQuery={controller.historyQuery}
          onDelete={controller.deleteAudit}
        />
        <details
          key={controller.historyQuery.data?.length ? "returning" : "new"}
          open={
            controller.historyQuery.isSuccess &&
            controller.historyQuery.data.length === 0
          }
          className="rounded-xl border p-4"
        >
          <summary className="cursor-pointer font-medium">
            Start a new audit
          </summary>
          <div className="mt-4 space-y-4">
            <ProjectResearchTarget
              projectId={projectId}
              onSelect={(domain) =>
                controller.launchForm.setFieldValue(
                  "url",
                  domain ? `https://${domain}` : "",
                )
              }
            />
            <LaunchFormCard
              launchForm={controller.launchForm}
              commitMaxPagesInput={controller.commitMaxPagesInput}
              maxPagesLimit={controller.maxPagesLimit}
              paidMaxPagesLimit={controller.paidMaxPagesLimit}
              canRenderJavaScript={controller.canRenderJavaScript}
              outOfCredits={controller.outOfCredits}
            />
          </div>
        </details>

        {controller.largeCrawlPages != null ? (
          <ConfirmDialog
            title="Start a large audit?"
            confirmLabel="Continue"
            onConfirm={controller.confirmLargeCrawl}
            onClose={controller.cancelLargeCrawl}
          >
            You are about to crawl {controller.largeCrawlPages.toLocaleString()}{" "}
            pages. This is okay, but it may take a while. Continue?
          </ConfirmDialog>
        ) : null}
      </div>
    </div>
  );
}
