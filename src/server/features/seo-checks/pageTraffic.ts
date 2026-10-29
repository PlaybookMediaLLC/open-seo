import { GscService } from "@/server/features/gsc/services/GscService";

/** Page clicks and impressions for the last 28 days; empty without GSC. */
export async function pageTraffic(projectId: string) {
  try {
    const result = await GscService.getPerformance({
      projectId,
      dateRange: "last_28_days",
      dimensions: ["page"],
      rowLimit: 1000,
    });
    return result.rows.flatMap((row) => {
      const url = row.keys?.[0];
      return url
        ? [{ url, clicks: row.clicks ?? 0, impressions: row.impressions ?? 0 }]
        : [];
    });
  } catch {
    return [];
  }
}
