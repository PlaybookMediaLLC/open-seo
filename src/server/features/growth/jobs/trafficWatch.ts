import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import { GscService } from "@/server/features/gsc/services/GscService";
import type { JobContext } from "../growthJobs";
import { GrowthJobRepository } from "../repositories/GrowthJobRepository";
import { trafficDrop } from "../trafficDrop";

const round = (value: number) => Math.round(value);

/** RFC-0008 5.8: one Search Console request, then the drop rule. */
export async function trafficWatchJob(context: JobContext) {
  const endDate = shiftGa4Date(
    ga4DateInTimeZone(context.now, "America/Los_Angeles"),
    -3,
  );
  const { rows } = await GscService.getPerformance({
    projectId: context.projectId,
    startDate: shiftGa4Date(endDate, -34),
    endDate,
    dimensions: ["date", "page"],
    rowLimit: 25_000,
    type: "web",
    dataState: "final",
  });
  const result = trafficDrop(rows, endDate);
  if (result.status === "incomplete") {
    context.log("warn", "Incomplete data");
    return { summary: "Skipped: Search Console data has missing dates." };
  }
  const { site, pages } = result;
  if (site.dropped || pages.length) {
    await GrowthJobRepository.notify({
      organizationId: context.organizationId,
      projectId: context.projectId,
      kind: "traffic_drop",
      title: site.dropped
        ? `Search clicks fell to ${round(site.after)} in the last 7 days`
        : `${pages.length} pages lost search clicks`,
      body: [
        `Last 7 days: ${round(site.after)} clicks, against ${round(site.before)} for the 28 days before, scaled to 7 days.`,
        ...pages.map(
          (page) =>
            `${new URL(page.page).pathname}: ${round(page.before)} → ${round(page.after)}`,
        ),
      ].join("\n"),
      linkPath: `/p/${context.projectId}/opportunities`,
      dedupeKey: endDate,
    });
  }
  return {
    summary: `Last 7 days: ${Math.round(site.after)} clicks; ${pages.length} pages dropped.`,
  };
}
