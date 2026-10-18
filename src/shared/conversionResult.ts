// RFC-0012 5.6: a before-and-after conversion result shows a direction only
// with enough data and a large enough change. Otherwise it is inconclusive.
const MIN_SESSIONS = 1_000;
const MIN_CONVERSIONS = 50;
const MIN_RELATIVE = 0.2;
const MIN_ABSOLUTE = 10;

export const CONVERSION_CAVEATS =
  "This compares two 28-day periods. It is not a controlled test. Seasonality, other site changes, tracking changes and GA4 sampling can move conversions, and a change can take weeks to show.";

type Period = { sessions: number; conversions: number };

const rate = (period: Period) =>
  period.sessions ? period.conversions / period.sessions : 0;

export function conversionResult(baseline: Period, observation: Period) {
  const before = rate(baseline);
  const after = rate(observation);
  const reasons: string[] = [];
  for (const [name, period] of [
    ["baseline", baseline],
    ["observation", observation],
  ] as const) {
    if (period.sessions < MIN_SESSIONS)
      reasons.push(
        `The ${name} period has ${period.sessions} sessions. A direction needs ${MIN_SESSIONS.toLocaleString("en-US")}.`,
      );
    if (period.conversions < MIN_CONVERSIONS)
      reasons.push(
        `The ${name} period has ${period.conversions} conversions. A direction needs ${MIN_CONVERSIONS}.`,
      );
  }
  if (!reasons.length) {
    // The small margin keeps an exact 20% change from failing on rounding.
    if (!before || Math.abs(after - before) / before < MIN_RELATIVE - 1e-9)
      reasons.push("The conversion rate changed by less than 20%.");
    if (Math.abs(observation.conversions - baseline.conversions) < MIN_ABSOLUTE)
      reasons.push(`Conversions changed by fewer than ${MIN_ABSOLUTE}.`);
  }
  return {
    before,
    after,
    label: reasons.length
      ? ("inconclusive" as const)
      : after > before
        ? ("rate_up" as const)
        : ("rate_down" as const),
    reasons,
  };
}
