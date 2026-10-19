import { useQuery } from "@tanstack/react-query";
import { dateLabel } from "@/client/features/opportunities/shared";
import { getAccessibilityTrend } from "@/serverFunctions/accessibility";
import { ACCESSIBILITY_LIMITS } from "@/shared/accessibility";
import { AccessibilityStatementSheet } from "./AccessibilityStatementSheet";

/** RFC-0013 5.5: violations per audit, and fixes that passed their check. */
export function AccessibilityTrend({ projectId }: { projectId: string }) {
  const query = useQuery({
    queryKey: ["accessibility-trend", projectId],
    queryFn: () => getAccessibilityTrend({ data: { projectId } }),
  });
  const trend = query.data;
  if (!trend?.audits.length) return null;
  return (
    <section
      className="rounded-xl border bg-card p-4 space-y-2 text-sm"
      aria-label="Accessibility trend"
    >
      <h2 className="font-medium">Accessibility trend</h2>
      <p className="text-muted-foreground">
        Serious and critical violations found by automated checks in each audit.{" "}
        {trend.fixesPassed} fixes passed their check after deployment.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 pr-4 font-medium">Audit</th>
              <th className="py-1 pr-4 font-medium">Pages checked</th>
              <th className="py-1 font-medium">Serious and critical</th>
            </tr>
          </thead>
          <tbody>
            {trend.audits.map((audit) => (
              <tr key={audit.auditId} className="border-t">
                <td className="py-1 pr-4">{dateLabel(audit.startedAt)}</td>
                <td className="py-1 pr-4">{audit.pagesChecked}</td>
                <td className="py-1">{audit.seriousViolations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{ACCESSIBILITY_LIMITS}</p>
      <AccessibilityStatementSheet projectId={projectId} />
    </section>
  );
}
