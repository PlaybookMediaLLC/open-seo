import { sort } from "remeda";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import type { OpportunityEvidence } from "@/types/schemas/opportunities";

export function OpportunityEvidenceHistory({
  evidence,
  latestRunId,
}: {
  evidence: OpportunityEvidence[];
  latestRunId: string;
}) {
  const groups = new Map<string, OpportunityEvidence[]>();
  for (const row of evidence)
    groups.set(row.runId, [...(groups.get(row.runId) ?? []), row]);
  const latest = groups.get(latestRunId) ?? [];
  const historical = [...groups.entries()].filter(([id]) => id !== latestRunId);
  return (
    <section className="space-y-4" aria-labelledby="evidence-heading">
      <div>
        <h2 id="evidence-heading" className="text-lg font-semibold">
          Search Console evidence
        </h2>
        <p className="text-sm text-muted-foreground">
          Observed search metrics, not a forecast or proof of causation. Current
          and comparison periods stay grouped by detection run.
        </p>
      </div>
      {latest.length ? (
        <EvidenceRun rows={latest} runId={latestRunId} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No evidence snapshot is available for the latest run.
        </p>
      )}
      {historical.length ? (
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Previous evidence snapshots ({historical.length} runs)
          </summary>
          <div className="mt-4 space-y-5">
            {historical.map(([id, rows]) => (
              <EvidenceRun key={id} rows={rows} runId={id} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function EvidenceRun({
  rows,
  runId,
}: {
  rows: OpportunityEvidence[];
  runId: string;
}) {
  return (
    <div className="space-y-2">
      <p className="break-all text-xs text-muted-foreground">Run {runId}</p>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Date range</TableHead>
              <TableHead>Clicks</TableHead>
              <TableHead>Impressions</TableHead>
              <TableHead>CTR</TableHead>
              <TableHead>Average position</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sort(rows, (a, b) => a.period.localeCompare(b.period)).map(
              (row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.period === "current" ? "Current" : "Previous"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {row.startDate} to {row.endDate}
                  </TableCell>
                  <TableCell>{row.clicks.toLocaleString()}</TableCell>
                  <TableCell>{row.impressions.toLocaleString()}</TableCell>
                  <TableCell>{(row.ctr * 100).toFixed(2)}%</TableCell>
                  <TableCell>{row.position.toFixed(1)}</TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  );
}
