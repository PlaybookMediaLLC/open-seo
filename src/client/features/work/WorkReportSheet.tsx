import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/client/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import { dateLabel } from "@/client/features/opportunities/shared";
import { formatMinor } from "@/shared/money";
import { getWorkReport } from "@/serverFunctions/work";

const MONTHS = 12;
const monthsBack = () =>
  Array.from({ length: MONTHS }, (_, index) => {
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - index);
    return date.toISOString().slice(0, 7);
  });

/** RFC-0018 5.7: the month's work from records, with every negative result. */
export function WorkReportSheet({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthsBack()[0] ?? "");
  const query = useQuery({
    queryKey: ["work-report", projectId, month],
    queryFn: () => getWorkReport({ data: { projectId, month } }),
    enabled: open,
  });
  const report = query.data;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Monthly report
      </Button>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Monthly work report</SheetTitle>
          <SheetDescription>
            What Relay changed, measured and waited for in one month, from the
            records. Negative results are always included.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 text-sm">
          <select
            aria-label="Month"
            className="h-9 w-full rounded-md border bg-background px-2"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          >
            {monthsBack().map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          {query.isPending && <p role="status">Loading the report…</p>}
          {report && (
            <>
              <section aria-label="Changes completed" className="space-y-1">
                <h3 className="font-medium">
                  Changes completed ({report.changes.length})
                </h3>
                {report.changes.map((change) => (
                  <p key={change.experimentId}>
                    {change.title} — {change.targetUrl}. Deployed{" "}
                    {dateLabel(change.deployedAt)} (
                    {change.deploymentBasis === "verified"
                      ? "verified"
                      : "attested"}
                    ){change.approver ? `, approved by ${change.approver}` : ""}
                    .
                  </p>
                ))}
                <p className="text-muted-foreground">
                  Estimated effort completed: {report.effortHours} hours
                  (Relay&apos;s estimate).
                </p>
              </section>
              <section aria-label="Results measured" className="space-y-1">
                <h3 className="font-medium">
                  Results measured: {report.results.encouraging} encouraging,{" "}
                  {report.results.inconclusive} inconclusive,{" "}
                  {report.results.negative} negative
                </h3>
                {report.results.items.map((item) => (
                  <p key={item.experimentId}>
                    <strong>{item.outcome}</strong>: {item.title}.{" "}
                    {item.explanation}
                    {item.conversions &&
                      ` Conversions: ${item.conversions.baseline} before, ${item.conversions.observation} after.`}
                    {item.revenue?.enough &&
                      ` First-touch revenue: ${item.revenue.baseline.revenue.map((row) => formatMinor(row.revenueMinor, row.currency)).join(", ")} before, ${item.revenue.observation.revenue.map((row) => formatMinor(row.revenueMinor, row.currency)).join(", ")} after.`}
                  </p>
                ))}
                <p className="text-xs text-muted-foreground">
                  Results are observations, not proof of cause. Payments can
                  come weeks after the first visit.
                </p>
              </section>
              <section aria-label="Approvals" className="space-y-1">
                <h3 className="font-medium">Approvals</h3>
                <p>
                  {report.approvals.count} changes approved
                  {report.approvals.medianHours !== null
                    ? `, a median of ${report.approvals.medianHours} hours after Relay prepared them`
                    : ""}
                  . {report.approvals.waiting} wait for approval now.
                </p>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
