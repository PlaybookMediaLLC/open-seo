import { eq } from "drizzle-orm";
import robotsParser from "robots-parser";
import { db } from "@/db";
import {
  ciCheckIgnores,
  ciCheckRuns,
  ciPreviewAccess,
  ciProjectSettings,
  projectKeyPages,
  projects,
} from "@/db/schema";
import { GscService } from "@/server/features/gsc/services/GscService";
import { openToken } from "@/server/features/publishing/tokenKeys";
import { discoverUrls } from "@/server/lib/audit/discovery";
import type { CrawlerAccess } from "@/shared/crawler-access";
import { selectUrls } from "./urlSelection";

// RFC-0010 5.2 step 6: the plan of one run. Its result is durable Workflow
// state, so it holds paths, traffic and booleans, never preview secrets.
const MAX_SITEMAP_URLS = 50;

/**
 * A page's URL in the site's own style: sites whose sitemap paths end in a
 * slash redirect the bare path, and a redirect on both hosts would skip it.
 */
export const pageUrl = (origin: string, path: string, trailingSlash: boolean) =>
  `${origin}${path}${
    trailingSlash && !path.endsWith("/") && !/\.[a-z0-9]+$/i.test(path)
      ? "/"
      : ""
  }`;

/** The protected-preview access, bound to the preview host only. */
export async function previewAccess(
  projectId: string,
  previewOrigin: string,
): Promise<CrawlerAccess | null> {
  const [row] = await db
    .select()
    .from(ciPreviewAccess)
    .where(eq(ciPreviewAccess.projectId, projectId));
  if (!row) return null;
  const { token: value } = await openToken({
    encryptedToken: row.encryptedValue,
    tokenKeyVersion: row.keyVersion,
  });
  const [clientId = "", clientSecret = ""] = value.split("\n");
  return {
    host: new URL(previewOrigin).hostname,
    headers:
      row.kind === "cf_access"
        ? {
            "CF-Access-Client-Id": clientId,
            "CF-Access-Client-Secret": clientSecret,
          }
        : { [row.headerName ?? "x-preview-access"]: value },
    expiresAt: null,
  };
}

/** Page clicks and impressions for the last 28 days; empty without GSC. */
async function pageTraffic(projectId: string) {
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

const allows = (
  robots: ReturnType<typeof robotsParser>,
  origin: string,
  path: string,
) => robots.isAllowed(`${origin}${path}`, "Googlebot") ?? true;

const pathOf = (url: string) => {
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
};

export async function planCheck(runId: string) {
  const [run] = await db
    .select()
    .from(ciCheckRuns)
    .where(eq(ciCheckRuns.id, runId));
  if (!run) throw new Error("The check run is missing.");
  await db
    .update(ciCheckRuns)
    .set({ status: "running", startedAt: new Date().toISOString() })
    .where(eq(ciCheckRuns.id, runId));
  const access = await previewAccess(run.projectId, run.previewOrigin);
  const [baseSite, previewSite, keyPages, traffic, [settings], [project]] =
    await Promise.all([
      discoverUrls(run.baseOrigin, MAX_SITEMAP_URLS),
      discoverUrls(run.previewOrigin, MAX_SITEMAP_URLS, access),
      db
        .select({ url: projectKeyPages.url, role: projectKeyPages.role })
        .from(projectKeyPages)
        .where(eq(projectKeyPages.projectId, run.projectId)),
      pageTraffic(run.projectId),
      db
        .select()
        .from(ciProjectSettings)
        .where(eq(ciProjectSettings.projectId, run.projectId)),
      db
        .select({ organizationId: projects.organizationId })
        .from(projects)
        .where(eq(projects.id, run.projectId)),
    ]);
  if (!project) throw new Error("The project is missing.");
  const urls = await selectUrls({
    changedFiles: run.changedFiles.split("\n").filter(Boolean),
    keyPages,
    topPages: traffic,
    sitemapUrls: baseSite.urls,
    headSha: run.headSha,
  });
  const baseRobots = robotsParser(
    `${run.baseOrigin}/robots.txt`,
    baseSite.robotsText ?? "",
  );
  const previewRobots = robotsParser(
    `${run.previewOrigin}/robots.txt`,
    previewSite.robotsText ?? "",
  );
  const ignores = await db
    .select({
      rule: ciCheckIgnores.rule,
      pathPattern: ciCheckIgnores.pathPattern,
    })
    .from(ciCheckIgnores)
    .where(eq(ciCheckIgnores.projectId, run.projectId));
  const nested = baseSite.urls.flatMap((url) => {
    const path = new URL(url).pathname;
    return path === "/" ? [] : [path];
  });
  return {
    runId,
    projectId: run.projectId,
    trailingSlash:
      nested.filter((path) => path.endsWith("/")).length > nested.length / 2,
    organizationId: project.organizationId,
    baseOrigin: run.baseOrigin,
    previewOrigin: run.previewOrigin,
    raiseOnHighTraffic: settings?.raiseOnHighTraffic ?? true,
    checkRobotsHeader: settings?.checkPreviewRobotsHeader ?? false,
    renderedMode: settings?.renderedMode ?? false,
    ignores,
    baseSitemapCount: baseSite.urls.length,
    previewSitemapCount: previewSite.urls.length,
    urls: urls.map((url) => {
      const page = traffic.find((row) => pathOf(row.url) === url.path);
      const role =
        keyPages.find((row) => pathOf(row.url) === url.path)?.role ?? null;
      return {
        ...url,
        clicks: page?.clicks ?? null,
        impressions: page?.impressions ?? null,
        role,
        baseAllowed: allows(baseRobots, run.baseOrigin, url.path),
        previewAllowed: allows(previewRobots, run.previewOrigin, url.path),
      };
    }),
  };
}

export type CheckPlan = Awaited<ReturnType<typeof planCheck>>;
