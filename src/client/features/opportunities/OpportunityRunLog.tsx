import { Badge } from "@/client/components/ui/badge";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import type { OpportunityRun } from "@/types/schemas/opportunities";
import { dateLabel } from "./shared";

export function OpportunityRunLog({ runs }: { runs: OpportunityRun[] }) {
  if (!runs.length) return null;
  return (
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer text-sm font-medium">
        Detection history ({runs.length} recent runs)
      </summary>
      <div className="mt-4 space-y-2">
        <p className="text-xs text-muted-foreground">
          Request counts show the run's reserved request budget, not a paid
          credit charge. Search data may be incomplete when row limits are
          reached.
        </p>
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Search periods</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="min-w-48">
                    <Badge
                      variant={
                        run.status === "failed"
                          ? "destructive"
                          : run.status === "completed"
                            ? "success"
                            : "secondary"
                      }
                    >
                      {run.status}
                    </Badge>
                    <p className="mt-1 text-xs">
                      Started {dateLabel(run.startedAt)}
                    </p>
                    {run.finishedAt ? (
                      <p className="text-xs text-muted-foreground">
                        Finished {dateLabel(run.finishedAt)}
                      </p>
                    ) : null}
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      {run.id}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-52 text-xs">
                    <p>
                      {run.startDate} to {run.endDate}
                    </p>
                    <p className="text-muted-foreground">
                      Previous: {run.previousStartDate} to {run.previousEndDate}
                    </p>
                    <p className="text-muted-foreground">
                      Year ago: both periods, 364 days earlier
                    </p>
                  </TableCell>
                  <TableCell className="min-w-36 text-xs">
                    <p>Query: {run.queryRows}</p>
                    <p>Pages: {run.currentPageRows}</p>
                    <p>Previous pages: {run.previousPageRows}</p>
                    <p>Year-ago pages: {run.yearAgoPageRows}</p>
                    <p className="text-muted-foreground">
                      {run.ga4PropertyId ? "GA4 used" : "No GA4 data"}
                    </p>
                    <p className="text-muted-foreground">
                      {run.auditId ? "Site audit used" : "No site audit"}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">
                    <p>{run.requestCount}</p>
                    {run.inspectionRequests ? (
                      <p className="text-muted-foreground">
                        Up to {run.inspectionRequests} URL inspections
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-sm whitespace-normal text-xs">
                    <p>{run.opportunityCount} opportunities</p>
                    {run.truncated ? (
                      <p className="mt-1 text-muted-foreground">
                        Row limit reached
                      </p>
                    ) : null}
                    {run.error ? (
                      <p className="mt-1 text-destructive">{run.error}</p>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      </div>
    </details>
  );
}
