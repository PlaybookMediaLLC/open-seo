import { Badge } from "@/client/components/ui/badge";
import { LiveSerpCheckSheet } from "./PaidChecks";
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
import { ACCESSIBILITY_LIMITS } from "@/shared/accessibility";
import { FIELD_DATA_LIMITS } from "@/shared/performance";
import { performanceRows } from "./performanceRows";

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
  // RFC-0012: conversion items count only the chosen key event.
  const conversion = latest.find((row) => row.keyEventName)?.keyEventName;
  if (conversion)
    return <ConversionEvidence rows={latest} eventName={conversion} />;
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
    | "auditEvidence"
    | "inspectionEvidence"
    | "linkEvidence"
    | "rankEvidence"
    | "accessibilityEvidence"
    | "performanceEvidence"
  >;
  latestRunId: string;
}) {
  const latest = <T extends { runId: string }>(rows: T[]) =>
    rows.filter((row) => row.runId === latestRunId);
  const [audit] = latest(detail.auditEvidence);
  const [inspection] = latest(detail.inspectionEvidence);
  const [link] = latest(detail.linkEvidence);
  const ranks = latest(detail.rankEvidence);
  const [accessibility] = latest(detail.accessibilityEvidence);
  const [performance] = latest(detail.performanceEvidence);
  return (
    <>
      {performance ? (
        <>
          <Facts
            title="Field data (Chrome UX Report)"
            rows={performanceRows(performance)}
          />
          <p className="text-sm text-muted-foreground">{FIELD_DATA_LIMITS}</p>
        </>
      ) : null}
      {accessibility ? (
        <>
          <Facts
            title="Accessibility (automated checks)"
            rows={[
              ["Rule", accessibility.ruleId],
              ["Impact", accessibility.impact],
              ["WCAG tags", accessibility.wcagTags],
              ["Pages affected", accessibility.pagesAffected],
              ["Example page", accessibility.exampleUrl],
              ["Example element", accessibility.exampleSelector],
              ["Example HTML", accessibility.exampleSnippet],
            ]}
          />
          <p className="text-sm text-muted-foreground">
            {ACCESSIBILITY_LIMITS}
          </p>
        </>
      ) : null}
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

/** Competitor keywords, AI citations and live results checks. */
export function PaidEvidence({
  detail,
  projectId,
}: {
  detail: Pick<
    OpportunityDetail,
    "opportunity" | "keywordEvidence" | "aiEvidence" | "serpChecks"
  >;
  projectId: string;
}) {
  const { opportunity } = detail;
  const latestRunId = opportunity.evidenceRunId;
  const keywords = detail.keywordEvidence.filter(
    (row) => row.runId === latestRunId,
  );
  const [ai] = detail.aiEvidence.filter((row) => row.runId === latestRunId);
  const [check] = detail.serpChecks;
  return (
    <>
      {ai ? (
        <Facts
          title="AI answers (30 days)"
          rows={[
            ["Answers that cite this page", `${ai.citations} of ${ai.answers}`],
            [
              "Period",
              `${ai.periodStart.slice(0, 10)} to ${ai.periodEnd.slice(0, 10)}`,
            ],
          ]}
        />
      ) : null}
      {keywords.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Competitor keywords</h2>
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Monthly searches</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Competitor</TableHead>
                  <TableHead>Position</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.keyword}</TableCell>
                    <TableCell>{row.searchVolume.toLocaleString()}</TableCell>
                    <TableCell>{row.keywordDifficulty ?? "—"}</TableCell>
                    <TableCell>{row.intent ?? "—"}</TableCell>
                    <TableCell className="max-w-xs whitespace-normal break-all">
                      {row.competitorUrl ?? row.competitorDomain}
                    </TableCell>
                    <TableCell>{row.competitorPosition}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
          <p className="text-xs text-muted-foreground">
            DataForSEO estimates, fetched {keywords[0].fetchedAt.slice(0, 10)}.
          </p>
        </section>
      ) : null}
      {opportunity.type === "low_ctr" ? (
        <section className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Live results</h2>
            <LiveSerpCheckSheet
              projectId={projectId}
              opportunityId={opportunity.id}
            />
          </div>
          {check ? (
            <p className="text-sm">
              On {check.checkedAt.slice(0, 10)}, for "{check.keyword}": your
              page was at position {check.pagePosition ?? "not in the top 20"}.
              Above it:{" "}
              {[
                check.hasAds && "ads",
                check.hasAiOverview && "an AI overview",
                check.hasFeaturedSnippet && "a featured snippet",
              ]
                .filter(Boolean)
                .join(", ") || "none of ads, AI overview or featured snippet"}
              . Confidence changed by {check.confidenceDelta > 0 ? "+" : ""}
              {check.confidenceDelta}.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not checked yet. A check shows whether ads or AI answers above
              your page explain the low click-through.
            </p>
          )}
        </section>
      ) : null}
    </>
  );
}

const count = (value: number | null) =>
  value === null ? "—" : value.toLocaleString();

function ConversionEvidence({
  rows,
  eventName,
}: {
  rows: OpportunityGa4Evidence[];
  eventName: string;
}) {
  return (
    <section className="space-y-3" aria-labelledby="ga4-heading">
      <div>
        <h2 id="ga4-heading" className="text-lg font-semibold">
          GA4 evidence
        </h2>
        <p className="text-sm text-muted-foreground">
          Sessions that started on this page in the run's 28 days, and its{" "}
          <code>{eventName}</code> conversions.
        </p>
      </div>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead>Engaged sessions</TableHead>
              <TableHead>Conversions</TableHead>
              <TableHead>Form starts</TableHead>
              <TableHead>Form submits</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.device === "all" ? "All devices" : row.device}
                </TableCell>
                <TableCell>{count(row.sessions)}</TableCell>
                <TableCell>{count(row.engagedSessions)}</TableCell>
                <TableCell>{count(row.keyEvents)}</TableCell>
                <TableCell>{count(row.formStarts)}</TableCell>
                <TableCell>{count(row.formSubmits)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </section>
  );
}
