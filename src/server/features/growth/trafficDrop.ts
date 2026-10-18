import { sortBy } from "remeda";
import { shiftGa4Date } from "@/server/features/ga4/services/Ga4Dates";

// RFC-0008 5.8: compare the last 7 final days with the 28 days before them,
// scaled to 7 days, for the site and for each page.
const SITE_DROP = 0.25;
const SITE_MIN_CLICKS = 100;
const PAGE_DROP = 0.3;
const PAGE_MIN_CLICKS = 30;
const MAX_PAGES = 10;

type Row = { keys?: string[] | null; clicks: number };
type PageDrop = { page: string; before: number; after: number };

type TrafficDrop =
  | { status: "incomplete" }
  | {
      status: "checked";
      site: { before: number; after: number; dropped: boolean };
      pages: PageDrop[];
    };

// The baseline covers 28 days; scale it to the 7-day window.
const scaled = (value: number) => value / 4;
const dropped = (before: number, after: number, share: number, min: number) =>
  before - after >= min && after <= before * (1 - share);

/** Rows by date and page for the 35 days that end on `endDate`. */
export function trafficDrop(rows: Row[], endDate: string): TrafficDrop {
  const recentStart = shiftGa4Date(endDate, -6);
  const baseStart = shiftGa4Date(endDate, -34);
  const dates = new Set<string>();
  const site = { before: 0, after: 0 };
  const pages = new Map<string, { before: number; after: number }>();
  for (const row of rows) {
    const [date, page] = row.keys ?? [];
    if (!date || !page || date < baseStart || date > endDate) continue;
    dates.add(date);
    const totals = pages.get(page) ?? { before: 0, after: 0 };
    if (date >= recentStart) {
      site.after += row.clicks;
      totals.after += row.clicks;
    } else {
      site.before += row.clicks;
      totals.before += row.clicks;
    }
    pages.set(page, totals);
  }
  // Skip the comparison when either window misses a date.
  if (dates.size < 35) return { status: "incomplete" };
  return {
    status: "checked",
    site: {
      before: scaled(site.before),
      after: site.after,
      dropped: dropped(
        scaled(site.before),
        site.after,
        SITE_DROP,
        SITE_MIN_CLICKS,
      ),
    },
    pages: sortBy(
      [...pages]
        .map(([page, totals]) => ({
          page,
          before: scaled(totals.before),
          after: totals.after,
        }))
        .filter((row) =>
          dropped(row.before, row.after, PAGE_DROP, PAGE_MIN_CLICKS),
        ),
      [(row) => row.before - row.after, "desc"],
    ).slice(0, MAX_PAGES),
  };
}
