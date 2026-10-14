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
  ExperimentDetail,
  MeasurementAssessment,
  MeasurementDay,
} from "@/types/schemas/experiments";

const number = (value: number | null, digits = 0) =>
  value === null
    ? "Unknown"
    : value.toLocaleString(undefined, { maximumFractionDigits: digits });
const percent = (value: number | null) =>
  value === null ? "Unknown" : `${number(value * 100, 2)}%`;

export function MeasurementResults({
  detail,
  assessment,
}: {
  detail: ExperimentDetail;
  assessment: MeasurementAssessment;
}) {
  const { experiment, latestRun } = detail;
  const pending = !latestRun || latestRun.status === "running";
  return (
    <section className="space-y-4" aria-label="Search Console results">
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Search Console observations</h2>
          <Badge
            variant={
              assessment.outcome === "negative" ? "warning" : "secondary"
            }
          >
            {pending ? "Pending" : assessment.outcome}
          </Badge>
        </div>
        <p className="text-sm">{assessment.explanation}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Baseline clicks</p>
            <p className="text-2xl font-semibold">
              {number(assessment.baseline.clicks)}
            </p>
            <p className="text-xs text-muted-foreground">
              {assessment.baseline.reportedDays}/28 days reported
            </p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Observation clicks</p>
            <p className="text-2xl font-semibold">
              {number(assessment.observation.clicks)}
            </p>
            <p className="text-xs text-muted-foreground">
              {assessment.observation.reportedDays}/28 days reported
            </p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              Raw measured click change
            </p>
            <p className="text-2xl font-semibold">
              {number(assessment.clickChange)}
            </p>
            <p className="text-xs text-muted-foreground">
              {assessment.clickChangePercent === null
                ? "Percentage unavailable"
                : `${number(assessment.clickChangePercent, 1)}%`}{" "}
              · not causal uplift
            </p>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Impressions</TableHead>
              <TableHead>Weighted CTR</TableHead>
              <TableHead>Weighted position</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(
              [
                ["Baseline", assessment.baseline],
                ["Observation", assessment.observation],
              ] as const
            ).map(([label, totals]) => (
              <TableRow key={label}>
                <TableCell>{label}</TableCell>
                <TableCell>{number(totals.impressions)}</TableCell>
                <TableCell>{percent(totals.ctr)}</TableCell>
                <TableCell>{number(totals.position, 2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-sm text-muted-foreground">
          These are returned aggregate metrics, not averages of daily
          percentages. Missing days are unknown, not zero. Partial windows are
          not directly comparable as a complete experiment.
        </p>
        {assessment.outcome === "negative" && !pending ? (
          <p className="rounded-lg border border-amber-500/30 p-3 text-sm">
            Recommendation: review the change, other site activity, and search
            demand. Consider a manual revert only after investigation. This
            assessment does not prove the change caused the decline and does not
            revert anything.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {pending
              ? "Measurement is pending. Confirm production deployment and request measurements explicitly when data is available."
              : assessment.outcome === "inconclusive"
                ? "Insufficient or confounded evidence: continue reviewing the evidence rather than declaring a winner."
                : "Encouraging observations are a reason to investigate further, not proof of causal improvement."}
          </p>
        )}
      </div>
      <div className="rounded-xl border bg-card p-5 space-y-3 text-sm">
        <h3 className="font-semibold">Windows, thresholds, and limits</h3>
        <p>
          Baseline:{" "}
          {experiment.baselineStart && experiment.baselineEnd
            ? `${experiment.baselineStart} to ${experiment.baselineEnd}`
            : "28 days before deployment"}
          . It is immutable after its first successful capture.
        </p>
        <p>
          Exclude deployment day and the next 6 days (D through D+6). Observe
          D+7 through D+34:{" "}
          {experiment.observationStart && experiment.observationEnd
            ? `${experiment.observationStart} to ${experiment.observationEnd}`
            : "not set until deployment confirmation"}
          . Allow 3 days of final-data lag.
        </p>
        <p>
          Directional labels require all 28 reported days in both windows, at
          least 100 baseline clicks, at least 1,000 impressions in each window,
          and an absolute click change of at least 20 plus a relative change of
          at least 20%. Known other changes, seasonal risk, or overlapping
          experiments make the result inconclusive.
        </p>
        <p className="text-muted-foreground">
          This is a before/after observation, not a controlled experiment.
          Search demand, ranking updates, reporting gaps, and unrelated changes
          can affect results. No causal attribution or revenue claim is made.
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant={experiment.otherChanges ? "warning" : "outline"}>
            Other changes:{" "}
            {experiment.otherChanges ? "reported" : "not reported"}
          </Badge>
          <Badge variant={experiment.seasonalRisk ? "warning" : "outline"}>
            Seasonal risk:{" "}
            {experiment.seasonalRisk ? "reported" : "not reported"}
          </Badge>
          <Badge
            variant={latestRun?.overlappingChanges ? "warning" : "outline"}
          >
            Overlap:{" "}
            {latestRun
              ? latestRun.overlappingChanges
                ? "detected"
                : "not detected"
              : "not assessed"}
          </Badge>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <DailyTrend
          title="Baseline daily trend"
          start={experiment.baselineStart}
          end={experiment.baselineEnd}
          days={detail.baselineDays}
        />
        <DailyTrend
          title="Observation daily trend"
          start={experiment.observationStart}
          end={experiment.observationEnd}
          days={detail.observationDays}
        />
      </div>
    </section>
  );
}

function DailyTrend({
  title,
  start,
  end,
  days,
}: {
  title: string;
  start: string | null;
  end: string | null;
  days: MeasurementDay[];
}) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const dates: string[] = [];
  if (start && end) {
    const first = Date.parse(`${start}T00:00:00Z`);
    const last = Date.parse(`${end}T00:00:00Z`);
    for (
      let time = first;
      Number.isFinite(time) && time <= last && dates.length < 28;
      time += 86_400_000
    )
      dates.push(new Date(time).toISOString().slice(0, 10));
  }
  return (
    <div className="min-w-0 space-y-2">
      <h3 className="font-semibold">{title}</h3>
      {!dates.length ? (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          Window not set. Confirm production deployment first.
        </p>
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Clicks</TableHead>
                <TableHead>Impressions</TableHead>
                <TableHead>CTR</TableHead>
                <TableHead>Position</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dates.map((date) => {
                const day = byDate.get(date);
                return (
                  <TableRow key={date}>
                    <TableCell>{date}</TableCell>
                    <TableCell>
                      {day ? number(day.clicks) : "Unknown"}
                    </TableCell>
                    <TableCell>
                      {day ? number(day.impressions) : "Unknown"}
                    </TableCell>
                    <TableCell>{day ? percent(day.ctr) : "Unknown"}</TableCell>
                    <TableCell>
                      {day ? number(day.position, 2) : "Unknown"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </div>
  );
}
