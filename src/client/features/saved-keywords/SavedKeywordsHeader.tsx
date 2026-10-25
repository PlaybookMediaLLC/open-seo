import { Link } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { useState } from "react";
import { IconRefresh as RefreshCw } from "@tabler/icons-react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { ExportMenu } from "@/client/components/ExportMenu";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";

export function SavedKeywordsHeader({
  totalCount,
  exporting,
  metricsRefreshing,
  onExportCsv,
  onExportSheets,
  onRefreshMetrics,
}: {
  totalCount: number;
  exporting: "csv" | "sheets" | null;
  metricsRefreshing: boolean;
  onExportCsv: () => void;
  onExportSheets: () => void;
  onRefreshMetrics: () => void;
}) {
  const [confirmingRefresh, setConfirmingRefresh] = useState(false);
  const disabled = totalCount === 0 || exporting != null;

  return (
    <>
      <PageHeader
        title="Saved Keywords"
        description="Save keyword ideas from research, organize them with tags, and revisit when you're ready to act."
        actions={
          totalCount > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                title="Fetch new volume, difficulty, and CPC"
                disabled={disabled || metricsRefreshing}
                onClick={() => setConfirmingRefresh(true)}
              >
                <RefreshCw
                  data-icon="inline-start"
                  className={metricsRefreshing ? "animate-spin" : ""}
                />
                {metricsRefreshing ? "Updating..." : "Update keyword stats"}
              </Button>

              <ExportMenu
                actions={["sheets", "csv"]}
                busy={exporting != null}
                disabled={disabled}
                onExport={(action) =>
                  action === "sheets" ? onExportSheets() : onExportCsv()
                }
              />
            </>
          )
        }
      />

      {confirmingRefresh ? (
        <ConfirmDialog
          title="Update keyword stats?"
          confirmLabel="Update stats"
          onConfirm={() => {
            setConfirmingRefresh(false);
            onRefreshMetrics();
          }}
          onClose={() => setConfirmingRefresh(false)}
        >
          This fetches new volume, difficulty, and CPC for every saved keyword
          in this project. Each keyword uses credits.
        </ConfirmDialog>
      ) : null}
    </>
  );
}

export function SavedKeywordsEmptyState({ projectId }: { projectId: string }) {
  return (
    <EmptyState
      title="Build your keyword collection"
      description="Save useful keywords from research, then compare and organize them here."
      action={
        <Button
          nativeButton={false}
          render={<Link to="/p/$projectId/keywords" params={{ projectId }} />}
        >
          Find keywords to save
        </Button>
      }
    />
  );
}
