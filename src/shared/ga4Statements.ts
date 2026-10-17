// RFC-0006 5.2: GA4 statements shown below the Search Console label. Each one
// appears only when the data supports it; the label itself never changes.
type Ga4Day = {
  period: "baseline" | "observation";
  sessions: number;
  keyEvents: number;
  revenue: number | null;
  currency: string | null;
};

export const GA4_THIN_DATA = "Too few sessions or events to compare.";
export const GA4_CAVEAT =
  "GA4 counts sessions that started on this page from organic search. Other pages, campaigns, tracking changes and seasonality also change these numbers.";
const WINDOW_DAYS = 28;
const MIN_SESSIONS = 100;
const MIN_KEY_EVENTS = 20;

const total = (rows: Ga4Day[], key: "sessions" | "keyEvents") =>
  rows.reduce((sum, row) => sum + row[key], 0);
const change = (before: number, after: number) => {
  const value = Math.round(((after - before) / before) * 100);
  return `${value > 0 ? "+" : ""}${value}%`;
};
const rate = (events: number, sessions: number) =>
  `${((events / sessions) * 100).toFixed(1)}%`;

export function ga4Statements(days: Ga4Day[]) {
  const baseline = days.filter((day) => day.period === "baseline");
  const observation = days.filter((day) => day.period === "observation");
  const sessions = [
    total(baseline, "sessions"),
    total(observation, "sessions"),
  ];
  const events = [
    total(baseline, "keyEvents"),
    total(observation, "keyEvents"),
  ];
  const revenue = [baseline, observation].map((rows) =>
    rows.some((row) => row.revenue !== null)
      ? rows.reduce((sum, row) => sum + (row.revenue ?? 0), 0)
      : null,
  );
  const fullSessions =
    baseline.length === WINDOW_DAYS &&
    observation.length === WINDOW_DAYS &&
    sessions.every((value) => value >= MIN_SESSIONS);
  const enoughEvents = events.every((value) => value >= MIN_KEY_EVENTS);
  const statements: string[] = [];
  if (fullSessions)
    statements.push(
      `Organic sessions changed by ${change(sessions[0], sessions[1])}.`,
    );
  if (enoughEvents)
    statements.push(`Key events changed by ${change(events[0], events[1])}.`);
  if (fullSessions && enoughEvents)
    statements.push(
      `Key event rate changed from ${rate(events[0], sessions[0])} to ${rate(events[1], sessions[1])}.`,
    );
  const [revenueBefore, revenueAfter] = revenue;
  if (revenueBefore !== null && revenueAfter !== null && enoughEvents)
    statements.push(
      `Revenue changed from ${revenueBefore.toFixed(2)} to ${revenueAfter.toFixed(2)} ${days.find((day) => day.currency)?.currency ?? ""}`.trim() +
        ".",
    );
  return {
    statements: statements.length ? statements : [GA4_THIN_DATA],
    sessions,
    events,
  };
}
