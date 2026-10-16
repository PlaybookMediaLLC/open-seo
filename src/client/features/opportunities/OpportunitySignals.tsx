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
  OpportunityDetail,
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

const ROLE_LABELS: Record<OpportunityUrl["role"], string> = {
  primary: "Primary",
  competing: "Competing",
  link_source: "Link from",
  link_target: "Link to",
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
              {ROLE_LABELS[item.role]}
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

function Facts({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string | number | null]>;
}) {
  return (
    <section className="space-y-2 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[12rem_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-all">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Audit, URL inspection, link and rank evidence from the latest run. */
export function AuditAndLinkEvidence({
  detail,
  latestRunId,
}: {
  detail: Pick<
    OpportunityDetail,
    "auditEvidence" | "inspectionEvidence" | "linkEvidence" | "rankEvidence"
  >;
  latestRunId: string;
}) {
  const latest = <T extends { runId: string }>(rows: T[]) =>
    rows.filter((row) => row.runId === latestRunId);
  const [audit] = latest(detail.auditEvidence);
  const [inspection] = latest(detail.inspectionEvidence);
  const [link] = latest(detail.linkEvidence);
  const ranks = latest(detail.rankEvidence);
  return (
    <>
      {audit ? (
        <Facts
          title="Site audit"
          rows={[
            ["Issue", audit.issueType],
            ["Severity", audit.severity],
            ["Page", audit.pageUrl],
            ["Audit completed", audit.auditCompletedAt],
          ]}
        />
      ) : null}
      {inspection ? (
        <Facts
          title="URL inspection"
          rows={[
            ["Verdict", inspection.verdict],
            ["Coverage", inspection.coverageState],
            ["Indexing", inspection.indexingState],
            ["robots.txt", inspection.robotsTxtState],
            ["Page fetch", inspection.pageFetchState],
            ["Google canonical", inspection.googleCanonical],
            ["Your canonical", inspection.userCanonical],
            ["Last crawl", inspection.lastCrawlTime],
            ["Inspected", inspection.inspectedAt],
          ]}
        />
      ) : null}
      {link ? (
        <Facts
          title="Link source"
          rows={[
            ["Add a link on", link.sourceUrl],
            ["Link to", link.targetUrl],
            ["Shared query", link.sharedQuery],
            ["Source impressions", link.sourceImpressions],
            ["Source position", link.sourcePosition.toFixed(1)],
          ]}
        />
      ) : null}
      {ranks.length ? (
        <Facts
          title="Rank history (30 days)"
          rows={ranks.map((rank) => [
            rank.device === "desktop" ? "Desktop" : "Mobile",
            `${rank.firstPosition ?? "not in top results"} on ${rank.firstCheckedAt.slice(0, 10)} → ${rank.lastPosition ?? "not in top results"} on ${rank.lastCheckedAt.slice(0, 10)}`,
          ])}
        />
      ) : null}
    </>
  );
}
