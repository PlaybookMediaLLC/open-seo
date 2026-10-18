import { sortBy } from "remeda";
import { db } from "@/db";
import { auditAccessibilityTargets } from "@/db/schema";
import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import { GscService } from "@/server/features/gsc/services/GscService";

// RFC-0013 5.2: runs in the app worker when an audit starts. It saves the
// 20 pages with the most organic clicks, from one free Search Console
// request. It never blocks or fails the audit.
const TOP_CLICK_PAGES = 20;

export async function saveAccessibilityTargets(
  auditId: string,
  projectId: string,
) {
  const endDate = shiftGa4Date(
    ga4DateInTimeZone(new Date(), "America/Los_Angeles"),
    -3,
  );
  try {
    const { rows } = await GscService.getPerformance(
      {
        projectId,
        startDate: shiftGa4Date(endDate, -27),
        endDate,
        dimensions: ["page"],
        rowLimit: 100,
        type: "web",
        dataState: "final",
      },
      { signal: AbortSignal.timeout(5_000) },
    );
    const urls = sortBy(rows, [(row) => row.clicks, "desc"])
      .slice(0, TOP_CLICK_PAGES)
      .flatMap((row) => row.keys?.[0] ?? []);
    if (urls.length)
      await db
        .insert(auditAccessibilityTargets)
        .values(urls.map((url) => ({ id: crypto.randomUUID(), auditId, url })));
  } catch {
    // Without Search Console, key pages and templates still choose the pages.
  }
}
