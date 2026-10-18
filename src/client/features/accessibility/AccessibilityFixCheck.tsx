import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { dateLabel } from "@/client/features/opportunities/shared";
import {
  checkAccessibilityFix,
  getAccessibilityFixCheck,
} from "@/serverFunctions/accessibility";
import { ACCESSIBILITY_LIMITS } from "@/shared/accessibility";

const LABELS = {
  passed: "Passed",
  failed: "Still fails",
  unchecked: "Not checked",
} as const;

/** RFC-0013 5.5: the fixed cluster, checked again on the live pages. */
export function AccessibilityFixCheck(props: {
  projectId: string;
  experimentId: string;
  deployed: boolean;
  canManage: boolean;
}) {
  const scope = {
    projectId: props.projectId,
    experimentId: props.experimentId,
  };
  const queryKey = [
    "accessibility-fix-check",
    props.projectId,
    props.experimentId,
  ];
  const client = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: () => getAccessibilityFixCheck({ data: scope }),
  });
  const run = useMutation({
    meta: { errorToast: false },
    mutationFn: () => checkAccessibilityFix({ data: scope }),
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
  const latest = query.data;
  return (
    <section
      className="rounded-xl border bg-card p-5 space-y-3"
      aria-label="Accessibility fix check"
    >
      <h2 className="text-lg font-semibold">Accessibility fix check</h2>
      {latest && (
        <>
          <p className="text-xs text-muted-foreground">
            Checked {dateLabel(latest.checkedAt)} · Rule {latest.ruleId}
          </p>
          <ul className="space-y-1 text-sm">
            {latest.pages.map((page) => (
              <li key={page.url} className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    page.outcome === "failed" ? "destructive" : "outline"
                  }
                >
                  {LABELS[page.outcome]}
                </Badge>
                <span className="break-all">{page.url}</span>
                {page.detail && (
                  <span className="break-all font-mono text-xs text-muted-foreground">
                    {page.detail}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {run.isError && (
        <p role="alert" className="text-sm text-destructive">
          {run.error.message}
        </p>
      )}
      {run.data && (
        <p
          role={run.data.ok ? "status" : "alert"}
          className={run.data.ok ? "text-sm" : "text-sm text-destructive"}
        >
          {run.data.message}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {props.deployed
          ? "Relay runs axe-core again on up to 10 pages where the audit found this issue. The check uses browser time."
          : "Confirm the production deployment first. The check reads the live pages."}{" "}
        {ACCESSIBILITY_LIMITS}
      </p>
      {props.canManage && (
        <Button
          variant="outline"
          pending={run.isPending}
          disabled={!props.deployed}
          onClick={() => run.mutate()}
        >
          {latest ? "Check again" : "Check the fix"}
        </Button>
      )}
    </section>
  );
}
