import {
  DEFAULT_BUDGETS,
  GATE_PACKS,
  parseGateConfig,
} from "@/shared/releaseGate";
import { eq } from "drizzle-orm";
import robotsParser from "robots-parser";
import { db } from "@/db";
import {
  ciCheckIgnores,
  ciCheckRuns,
  ciPreviewAccess,
  ciPreviewHosts,
  ciProjectSettings,
  projectKeyPages,
  projects,
} from "@/db/schema";
import { openToken } from "@/server/features/publishing/tokenKeys";
import { discoverUrls } from "@/server/lib/audit/discovery";
import type { CrawlerAccess } from "@/shared/crawler-access";
import { pageTraffic } from "./pageTraffic";
import { isTrustedPreviewHost } from "./previewHosts";
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

/**
 * The protected-preview access, bound to the preview host. RFC-0010 5.4: a
 * stored secret is withheld unless the owner vouched for that host.
 */
export async function previewAccess(run: {
  projectId: string;
  baseOrigin: string;
  previewOrigin: string;
}): Promise<{ access: CrawlerAccess | null; withheld: boolean }> {
  const [row] = await db
    .select()
    .from(ciPreviewAccess)
    .where(eq(ciPreviewAccess.projectId, run.projectId));
  if (!row) return { access: null, withheld: false };
  const host = new URL(run.previewOrigin).hostname;
  const ownerHosts = await db
    .select({ host: ciPreviewHosts.host })
    .from(ciPreviewHosts)
    .where(eq(ciPreviewHosts.projectId, run.projectId));
  // The base origin is the project's domain, set by Relay when it was queued.
  if (
    !isTrustedPreviewHost(
      host,
      new URL(run.baseOrigin).hostname,
      ownerHosts.map((owner) => owner.host),
    )
  )
    return { access: null, withheld: true };
  const { token: value } = await openToken({
    encryptedToken: row.encryptedValue,
    tokenKeyVersion: row.keyVersion,
  });
  const [clientId = "", clientSecret = ""] = value.split("\n");
  return {
    access: {
      host,
      headers:
        row.kind === "cf_access"
          ? {
              "CF-Access-Client-Id": clientId,
              "CF-Access-Client-Secret": clientSecret,
            }
          : { [row.headerName ?? "x-preview-access"]: value },
      expiresAt: null,
    },
    withheld: false,
  };
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
  const { access, withheld } = await previewAccess(run);
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
  // RFC-0015 5.4: the file was validated when the run was queued.
  const gate = run.gateConfig ? parseGateConfig(run.gateConfig) : null;
  if (gate && "error" in gate) throw new Error(gate.error);
  const config = gate && "config" in gate ? gate.config : null;
  const enabled = run.packsEnabled.split(" ");
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
    previewAccessWithheld: withheld,
    raiseOnHighTraffic: settings?.raiseOnHighTraffic ?? true,
    checkRobotsHeader: settings?.checkPreviewRobotsHeader ?? false,
    renderedMode: settings?.renderedMode ?? false,
    packs: GATE_PACKS.filter((pack) => enabled.includes(pack)),
    budgets: { ...DEFAULT_BUDGETS, ...config?.budgets },
    fileIgnores: config?.ignore ?? [],
    ignores: [
      ...ignores,
      ...(config?.ignore ?? []).map((ignore) => ({
        rule: ignore.rule,
        pathRegex: ignore.path,
      })),
    ],
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
