import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import { downloadFile } from "@/client/lib/download";
import {
  exportExperimentCsv,
  getMeasurementSettings,
  listExperimentKeyEvents,
  saveMeasurementSettings,
} from "@/serverFunctions/experiments";
import {
  CONVERSION_CAVEATS,
  conversionResult,
} from "@/shared/conversionResult";
import { GA4_CAVEAT, ga4Statements } from "@/shared/ga4Statements";
import type { ExperimentDetail } from "@/types/schemas/experiments";

const MAX_KEY_EVENTS = 5;
const settingsKey = (projectId: string, experimentId: string) => [
  "experiments",
  projectId,
  "settings",
  experimentId,
];
const count = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 0 });

/** RFC-0006 5.5: the stored daily rows, built on the server. */
export function DownloadCsvButton({
  projectId,
  experimentId,
}: {
  projectId: string;
  experimentId: string;
}) {
  const download = useMutation({
    mutationFn: () =>
      exportExperimentCsv({ data: { projectId, experimentId } }),
    onSuccess: ({ csv, filename }) =>
      downloadFile(csv, filename, "text/csv;charset=utf-8"),
  });
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      pending={download.isPending}
      onClick={() => download.mutate()}
    >
      Download CSV
    </Button>
  );
}

/** RFC-0006 5.2: GA4 numbers below the Search Console label. */
export function Ga4Results({ detail }: { detail: ExperimentDetail }) {
  const { experiment, latestRun, ga4Days, ga4EventTotals } = detail;
  const settings = useQuery({
    queryKey: settingsKey(experiment.projectId, experiment.id),
    queryFn: () =>
      getMeasurementSettings({
        data: { projectId: experiment.projectId, experimentId: experiment.id },
      }),
    enabled: Boolean(experiment.ga4PropertyId),
  });
  if (!experiment.ga4PropertyId) return null;
  const { statements, sessions, events } = ga4Statements(ga4Days);
  const reported = (period: "baseline" | "observation") =>
    ga4Days.filter((day) => day.period === period).length;
  const timeZone = settings.data?.timeZone;
  return (
    <section
      className="space-y-3 rounded-xl border bg-card p-5"
      aria-label="GA4 supporting evidence"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">GA4 supporting evidence</h2>
        {settings.data?.canManage && (
          <KeyEventsSheet
            projectId={experiment.projectId}
            experimentId={experiment.id}
            saved={settings.data.keyEvents}
            autoRefresh={settings.data.autoRefresh}
          />
        )}
      </div>
      {latestRun?.ga4Error ? (
        <p role="alert" className="text-sm">
          GA4 data unavailable: {latestRun.ga4Error}
        </p>
      ) : !latestRun ? (
        <p className="text-sm text-muted-foreground">
          GA4 numbers appear after the first measurement.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Organic sessions</p>
              <p className="text-lg font-semibold">
                {count(sessions[0])} → {count(sessions[1])}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Key events</p>
              <p className="text-lg font-semibold">
                {count(events[0])} → {count(events[1])}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">
                Days with GA4 data
              </p>
              <p className="text-lg font-semibold">
                {reported("baseline")}/28 → {reported("observation")}/28
              </p>
            </div>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {statements.map((statement) => (
              <li key={statement}>{statement}</li>
            ))}
          </ul>
          {detail.conversionEvent && (
            <ConversionCard
              eventName={detail.conversionEvent}
              sessions={sessions}
              totals={ga4EventTotals}
            />
          )}
          {ga4EventTotals.length > 0 && (
            <ul className="space-y-1 text-sm">
              {[...new Set(ga4EventTotals.map((row) => row.eventName))].map(
                (name) => {
                  const total = (period: "baseline" | "observation") =>
                    ga4EventTotals.find(
                      (row) => row.eventName === name && row.period === period,
                    )?.keyEvents ?? 0;
                  return (
                    <li key={name}>
                      <code>{name}</code>: {count(total("baseline"))} →{" "}
                      {count(total("observation"))}
                    </li>
                  );
                },
              )}
            </ul>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Baseline → observation. GA4 dates use the property time zone
        {timeZone ? ` (${timeZone})` : ""}. Days that GA4 did not report stay
        empty, never zero. {GA4_CAVEAT}
      </p>
    </section>
  );
}

const percent = (value: number) => `${(value * 100).toFixed(2)}%`;

/** RFC-0012 5.6: the chosen conversion, before and after, with its caveats. */
function ConversionCard(props: {
  eventName: string;
  sessions: number[];
  totals: ExperimentDetail["ga4EventTotals"];
}) {
  const total = (period: "baseline" | "observation") =>
    props.totals.find(
      (row) => row.eventName === props.eventName && row.period === period,
    )?.keyEvents ?? 0;
  const result = conversionResult(
    { sessions: props.sessions[0] ?? 0, conversions: total("baseline") },
    { sessions: props.sessions[1] ?? 0, conversions: total("observation") },
  );
  return (
    <div className="space-y-1 rounded-lg border p-3 text-sm">
      <p className="font-medium">
        Conversions (<code>{props.eventName}</code>): {count(total("baseline"))}{" "}
        → {count(total("observation"))}, rate {percent(result.before)} →{" "}
        {percent(result.after)}
      </p>
      <p>
        {result.label === "inconclusive"
          ? `Inconclusive. ${result.reasons.join(" ")}`
          : `Directional: the conversion rate went ${result.label === "rate_up" ? "up" : "down"}.`}
      </p>
      <p className="text-xs text-muted-foreground">{CONVERSION_CAVEATS}</p>
    </div>
  );
}

function KeyEventsSheet({
  projectId,
  experimentId,
  saved,
  autoRefresh,
}: {
  projectId: string;
  experimentId: string;
  saved: string[];
  autoRefresh: boolean;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState(saved);
  const names = useQuery({
    queryKey: [...settingsKey(projectId, experimentId), "key-events"],
    queryFn: () =>
      listExperimentKeyEvents({ data: { projectId, experimentId } }),
    enabled: open,
  });
  const save = useMutation({
    mutationFn: () =>
      saveMeasurementSettings({
        data: { projectId, experimentId, autoRefresh, keyEvents: chosen },
      }),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: settingsKey(projectId, experimentId),
      });
      setOpen(false);
    },
  });
  const options = [...new Set([...saved, ...(names.data?.names ?? [])])];
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setChosen(saved);
          setOpen(true);
        }}
      >
        Key events
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Key events to report</SheetTitle>
            <SheetDescription>
              Choose up to {MAX_KEY_EVENTS} key events. Relay reports each one
              separately from the next measurement on. Without a choice, it
              reports the total of all key events.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-2 px-4">
            {names.isPending && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {names.data?.error && (
              <p role="alert" className="text-sm">
                {names.data.error}
              </p>
            )}
            {options.map((name) => (
              <label key={name} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={chosen.includes(name)}
                  disabled={
                    !chosen.includes(name) && chosen.length >= MAX_KEY_EVENTS
                  }
                  onCheckedChange={(checked) =>
                    setChosen((current) =>
                      checked
                        ? [...current, name]
                        : current.filter((item) => item !== name),
                    )
                  }
                />
                <code>{name}</code>
              </label>
            ))}
          </div>
          <SheetFooter>
            <Button
              type="button"
              pending={save.isPending}
              onClick={() => save.mutate()}
            >
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
