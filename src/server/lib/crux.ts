import { z } from "zod";
import { AppError } from "@/server/lib/errors";

// RFC-0014 5.2: the Chrome UX Report API. It returns the 75th percentile of
// real Chrome users over 28 days, for a URL or an origin. A target without
// enough users answers 404, which is "no data", not an error.
const QUERY_URL =
  "https://chromeuxreport.googleapis.com/v1/records:queryRecord";
const METRICS = [
  "largest_contentful_paint",
  "interaction_to_next_paint",
  "cumulative_layout_shift",
] as const;
export type FormFactor = "phone" | "desktop";

const p75 = z
  .object({ percentiles: z.object({ p75: z.coerce.number() }) })
  .optional();
const day = z.object({
  year: z.number().int(),
  month: z.number().int(),
  day: z.number().int(),
});
const recordSchema = z.object({
  record: z.object({
    metrics: z.object({
      largest_contentful_paint: p75,
      interaction_to_next_paint: p75,
      cumulative_layout_shift: p75,
    }),
    collectionPeriod: z.object({ lastDate: day }),
  }),
});

const isoDate = ({ year, month, day: date }: z.infer<typeof day>) =>
  `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;

/** One target's p75 values, or null when CrUX has too few users for it. */
export async function queryCrux(
  apiKey: string,
  target: { scope: "url" | "origin"; value: string },
  formFactor: FormFactor,
) {
  const response = await fetch(
    `${QUERY_URL}?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        [target.scope]: target.value,
        formFactor: formFactor.toUpperCase(),
        metrics: METRICS,
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (response.status === 404) {
    await response.body?.cancel();
    return null;
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new AppError(
      response.status === 429 ? "RATE_LIMITED" : "UPSTREAM_UNAVAILABLE",
      `The Chrome UX Report answered ${response.status}.`,
    );
  }
  const { record } = recordSchema.parse(await response.json());
  return {
    collectionEnd: isoDate(record.collectionPeriod.lastDate),
    lcpP75Ms: record.metrics.largest_contentful_paint?.percentiles.p75 ?? null,
    inpP75Ms: record.metrics.interaction_to_next_paint?.percentiles.p75 ?? null,
    clsP75: record.metrics.cumulative_layout_shift?.percentiles.p75 ?? null,
  };
}

const HISTORY_URL =
  "https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord";
// A missing week is null or "NaN" in the history series.
const series = z
  .object({
    percentilesTimeseries: z.object({
      p75s: z.array(z.union([z.number(), z.string(), z.null()])),
    }),
  })
  .optional();
const historySchema = z.object({
  record: z.object({
    metrics: z.object({
      largest_contentful_paint: series,
      interaction_to_next_paint: series,
      cumulative_layout_shift: series,
    }),
    collectionPeriods: z.array(z.object({ lastDate: day })),
  }),
});
const pointAt = (values: z.infer<typeof series>, index: number) => {
  const value = Number(values?.percentilesTimeseries.p75s[index] ?? Number.NaN);
  return Number.isFinite(value) ? value : null;
};

/** RFC-0014 5.6: up to 25 weekly 28-day points, oldest first. */
export async function queryCruxHistory(
  apiKey: string,
  target: { scope: "url" | "origin"; value: string },
  formFactor: FormFactor,
) {
  const response = await fetch(
    `${HISTORY_URL}?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        [target.scope]: target.value,
        formFactor: formFactor.toUpperCase(),
        metrics: METRICS,
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (response.status === 404) {
    await response.body?.cancel();
    return null;
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new AppError(
      response.status === 429 ? "RATE_LIMITED" : "UPSTREAM_UNAVAILABLE",
      `The Chrome UX Report answered ${response.status}.`,
    );
  }
  const { record } = historySchema.parse(await response.json());
  return record.collectionPeriods.map((period, index) => ({
    collectionEnd: isoDate(period.lastDate),
    lcpP75Ms: pointAt(record.metrics.largest_contentful_paint, index),
    inpP75Ms: pointAt(record.metrics.interaction_to_next_paint, index),
    clsP75: pointAt(record.metrics.cumulative_layout_shift, index),
  }));
}
