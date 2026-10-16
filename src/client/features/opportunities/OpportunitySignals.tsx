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
import type {
  OpportunityDiagnosis,
  OpportunityGa4Evidence,
  OpportunityUrl,
} from "@/types/schemas/opportunities";

export const diagnosisLabels: Record<OpportunityDiagnosis, string> = {
  ranking_drop: "Ranking drop",
  demand_drop: "Demand drop",
  ctr_drop: "Click-through drop",
  mixed: "More than one cause",
  seasonal: "Possibly seasonal",
  unknown: "Cause unclear",
};

/** The pages of an opportunity about two or more URLs. */
export function CompetingPages({ urls }: { urls: OpportunityUrl[] }) {
  if (!urls.length) return null;
  return (
    <section className="space-y-3" aria-labelledby="pages-heading">
      <h2 id="pages-heading" className="text-lg font-semibold">
        Pages
      </h2>
      <ul className="divide-y rounded-xl border">
        {urls.map((item) => (
          <li key={item.id} className="flex items-center gap-3 p-3 text-sm">
            <Badge variant={item.role === "primary" ? "secondary" : "outline"}>
              {item.role === "primary" ? "Primary" : "Competing"}
            </Badge>
            <span className="break-all">{item.url}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** GA4 organic landing-page rows from the latest run. */
export function Ga4Evidence({
  rows,
  latestRunId,
}: {
  rows: OpportunityGa4Evidence[];
  latestRunId: string;
}) {
  const latest = rows.filter((row) => row.runId === latestRunId);
  return (
    <section className="space-y-3" aria-labelledby="ga4-heading">
      <div>
        <h2 id="ga4-heading" className="text-lg font-semibold">
          GA4 evidence
        </h2>
        <p className="text-sm text-muted-foreground">
          Organic Search sessions that started on this page. Key events set the
          GA4 part of the commercial score.
        </p>
      </div>
      {latest.length ? (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Landing page</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Key events</TableHead>
                <TableHead>Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {latest.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.period === "current" ? "Current" : "Previous"}
                  </TableCell>
                  <TableCell className="break-all">{row.landingPage}</TableCell>
                  <TableCell>{row.sessions.toLocaleString()}</TableCell>
                  <TableCell>{row.keyEvents.toLocaleString()}</TableCell>
                  <TableCell>
                    {row.revenue === null
                      ? "—"
                      : `${row.revenue.toLocaleString()} ${row.currency ?? ""}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      ) : (
        <p className="text-sm text-muted-foreground">
          No GA4 rows for this page in the latest run. GA4 may not be connected,
          or the page had no organic sessions.
        </p>
      )}
    </section>
  );
}
