/**
 * Seed the local D1 database with the demo data the marketing screenshots are
 * captured from: a Search Console connection, a completed opportunity run with
 * scored opportunities and their evidence, and a saved-keyword list.
 * Fully offline — no Google or DataForSEO credentials needed.
 *
 * Usage:
 *   pnpm db:migrate:local      # once — creates the local D1
 *   pnpm seed:marketing        # seed demo data
 *   pnpm seed:marketing --clean
 *
 * Pair it with `pnpm seed:rank-tracking` for the Rank Tracking screens, then
 * capture with `pnpm capture:product`.
 *
 * The Search Console connection row is local-only: it names a property so the
 * Opportunities screens render their loaded state. No tokens are stored, so
 * nothing can call Google with it.
 */

import process from "node:process";
import { getPlatformProxy } from "wrangler";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
// Import the sqlite schema files directly: the "../src/db/schema" barrel pulls
// in provider.ts, whose `cloudflare:workers` import Node's loader can't
// resolve outside the Workers runtime.
import * as appSchema from "../src/db/app.schema";
import { gscConnections } from "../src/db/gsc.schema";
import {
  opportunities,
  opportunityEvidence,
  opportunityRuns,
} from "../src/db/opportunities.schema";
import { organization, user } from "../src/db/better-auth-schema";
import { parseArgs } from "./cli-utils";

const schema = {
  ...appSchema,
  gscConnections,
  opportunities,
  opportunityEvidence,
  opportunityRuns,
  organization,
  user,
};

const LOCAL_ADMIN_USER_ID = "local-admin";
const LOCAL_ADMIN_EMAIL = "admin@localhost";
const LOCAL_ORG_ID = `delegated-${LOCAL_ADMIN_USER_ID}`;
const DOMAIN = "acme-demo.com";
const SITE_URL = `sc-domain:${DOMAIN}`;

type SeedDb = ReturnType<typeof drizzle<typeof schema>>;

type Demo = {
  url: string;
  query: string;
  title: string;
  action: string;
  intent: string;
  priority: number;
  clicks: number;
  impressions: number;
  position: number;
  previousPosition: number;
};

const OPPORTUNITIES: Demo[] = [
  {
    url: "/pricing",
    query: "seo tool pricing",
    title: "Rewrite the title and description on /pricing",
    action:
      "Lead the title with the price and add a description. The page ranks well but few searchers click it.",
    intent: "commercial",
    priority: 92,
    clicks: 204,
    impressions: 18_412,
    position: 4.2,
    previousPosition: 4.1,
  },
  {
    url: "/blog/seo-audit-checklist",
    query: "seo audit checklist",
    title: "Answer the top follow-up questions on the audit checklist",
    action:
      "Add an FAQ section covering the questions this page already ranks for just outside the top ten.",
    intent: "informational",
    priority: 87,
    clicks: 141,
    impressions: 6_233,
    position: 8.1,
    previousPosition: 9.4,
  },
  {
    url: "/features",
    query: "seo rank tracker features",
    title: "Fix the duplicate meta description on /features",
    action:
      "This page shares its description with /pricing, so Google rewrites it. Give it its own.",
    intent: "commercial",
    priority: 78,
    clicks: 96,
    impressions: 4_803,
    position: 11.2,
    previousPosition: 10.6,
  },
  {
    url: "/integrations",
    query: "seo api",
    title: "Target “seo api” on /integrations",
    action:
      "The page mentions the API in passing. Give it a section and an H2 to match the query.",
    intent: "commercial",
    priority: 74,
    clicks: 58,
    impressions: 2_915,
    position: 14.3,
    previousPosition: 15.8,
  },
  {
    url: "/blog/keyword-clustering",
    query: "keyword clustering",
    title: "Refresh the keyword clustering guide",
    action:
      "Impressions fell 38% quarter over quarter. Update the examples and re-publish.",
    intent: "informational",
    priority: 69,
    clicks: 77,
    impressions: 5_120,
    position: 12.7,
    previousPosition: 8.9,
  },
  {
    url: "/compare/semrush-alternative",
    query: "semrush alternative",
    title: "Add a comparison table to the Semrush alternative page",
    action:
      "Competing pages all lead with a feature table. This page buries the comparison in prose.",
    intent: "commercial",
    priority: 66,
    clicks: 43,
    impressions: 3_480,
    position: 9.6,
    previousPosition: 11.1,
  },
];

/** Saved keywords, with the metrics a real DataForSEO lookup would have filled
 *  in: volume, CPC, competition, difficulty and intent. */
const SAVED_KEYWORDS: {
  keyword: string;
  volume: number;
  cpc: number;
  competition: number;
  difficulty: number;
  intent: string;
}[] = [
  {
    keyword: "seo audit checklist",
    volume: 6600,
    cpc: 8.4,
    competition: 0.42,
    difficulty: 22,
    intent: "informational",
  },
  {
    keyword: "keyword clustering",
    volume: 2900,
    cpc: 6.1,
    competition: 0.38,
    difficulty: 28,
    intent: "informational",
  },
  {
    keyword: "rank tracking api",
    volume: 1300,
    cpc: 8.9,
    competition: 0.51,
    difficulty: 34,
    intent: "commercial",
  },
  {
    keyword: "semrush alternative",
    volume: 8100,
    cpc: 14.2,
    competition: 0.77,
    difficulty: 53,
    intent: "commercial",
  },
  {
    keyword: "best seo tools for startups",
    volume: 4400,
    cpc: 11.7,
    competition: 0.68,
    difficulty: 47,
    intent: "commercial",
  },
  {
    keyword: "ai content optimization",
    volume: 2400,
    cpc: 8.3,
    competition: 0.45,
    difficulty: 38,
    intent: "informational",
  },
  {
    keyword: "local seo services",
    volume: 6600,
    cpc: 14.2,
    competition: 0.82,
    difficulty: 53,
    intent: "transactional",
  },
  {
    keyword: "backlink gap analysis",
    volume: 880,
    cpc: 7.2,
    competition: 0.36,
    difficulty: 25,
    intent: "informational",
  },
  {
    keyword: "technical seo audit",
    volume: 3600,
    cpc: 12.4,
    competition: 0.63,
    difficulty: 44,
    intent: "commercial",
  },
  {
    keyword: "search console api",
    volume: 1900,
    cpc: 5.3,
    competition: 0.29,
    difficulty: 31,
    intent: "informational",
  },
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log("Setting up local D1 connection...");
  const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>();
  const db = drizzle(env.DB, { schema });

  try {
    const projectId = await resolveProject(db);

    // Re-running replaces the demo rows, so repeated captures stay identical.
    await db
      .delete(schema.opportunityRuns)
      .where(eq(schema.opportunityRuns.projectId, projectId));
    await db
      .delete(schema.gscConnections)
      .where(eq(schema.gscConnections.projectId, projectId));
    await db
      .delete(schema.savedKeywords)
      .where(eq(schema.savedKeywords.projectId, projectId));

    if (args.clean === "true") {
      console.log("Removed seeded marketing data.");
      return;
    }

    await db
      .update(schema.projects)
      .set({ domain: DOMAIN })
      .where(eq(schema.projects.id, projectId));

    await db.insert(schema.gscConnections).values({
      id: crypto.randomUUID(),
      projectId,
      organizationId: LOCAL_ORG_ID,
      siteUrl: SITE_URL,
      connectedByUserId: LOCAL_ADMIN_USER_ID,
      connectedAccountEmail: LOCAL_ADMIN_EMAIL,
    });
    console.log(`Connected ${SITE_URL} (local-only, no tokens).`);

    const now = new Date();
    const runId = crypto.randomUUID();
    await db.insert(schema.opportunityRuns).values({
      id: runId,
      projectId,
      siteUrl: SITE_URL,
      status: "completed",
      requestedBy: LOCAL_ADMIN_USER_ID,
      startDate: isoDate(now, -28),
      endDate: isoDate(now, -1),
      previousStartDate: isoDate(now, -56),
      previousEndDate: isoDate(now, -29),
      startedAt: isoTimestamp(now, -2),
      finishedAt: isoTimestamp(now, -1),
      queryRows: 1000,
      currentPageRows: 1000,
      previousPageRows: 1000,
      requestCount: 3,
      opportunityCount: OPPORTUNITIES.length,
    });

    for (const [index, item] of OPPORTUNITIES.entries()) {
      const opportunityId = crypto.randomUUID();
      const declining = item.position > item.previousPosition;
      await db.insert(schema.opportunities).values({
        id: opportunityId,
        projectId,
        siteUrl: SITE_URL,
        identityKey: `${item.url}::${item.query}`,
        type: declining ? "declining_page" : "striking_distance",
        url: `https://${DOMAIN}${item.url}`,
        query: item.query,
        title: item.title,
        explanation: `“${item.query}” brings ${item.impressions.toLocaleString("en-US")} impressions at position ${item.position.toFixed(1)}, but only ${item.clicks} clicks.`,
        recommendedAction: item.action,
        searchIntent: item.intent,
        confidence: 0.82 - index * 0.04,
        effortHours: 1 + index * 0.5,
        priority: item.priority,
        commercialScore: item.intent === "commercial" ? 0.84 : 0.52,
        demandScore: Math.min(1, item.impressions / 20_000),
        visibilityScore: Math.max(0, 1 - item.position / 20),
        difficultyScore: 0.4 + index * 0.05,
        effortScore: 0.3 + index * 0.08,
        scoreExplanation:
          "Scored on commercial intent, demand, current visibility and the effort to ship the change.",
        uncertainty:
          "Search Console reports rounded averages, so small position moves can be noise.",
        status: index === 0 ? "reviewed" : "discovered",
        evidenceRunId: runId,
        firstDetectedAt: isoTimestamp(now, -24 * 14),
        lastDetectedAt: isoTimestamp(now, -1),
      });

      // Current and previous windows, so the UI can show the trend.
      await db.insert(schema.opportunityEvidence).values([
        {
          id: crypto.randomUUID(),
          projectId,
          opportunityId,
          runId,
          source: "google_search_console",
          period: "current",
          startDate: isoDate(now, -28),
          endDate: isoDate(now, -1),
          clicks: item.clicks,
          impressions: item.impressions,
          ctr: item.clicks / item.impressions,
          position: item.position,
        },
        {
          id: crypto.randomUUID(),
          projectId,
          opportunityId,
          runId,
          source: "google_search_console",
          period: "previous",
          startDate: isoDate(now, -56),
          endDate: isoDate(now, -29),
          clicks: Math.round(item.clicks * 0.78),
          impressions: Math.round(item.impressions * 0.86),
          ctr: (item.clicks * 0.78) / (item.impressions * 0.86),
          position: item.previousPosition,
        },
      ]);
    }
    console.log(
      `Inserted ${OPPORTUNITIES.length} opportunities with evidence.`,
    );

    await db.insert(schema.savedKeywords).values(
      SAVED_KEYWORDS.map(({ keyword }) => ({
        id: crypto.randomUUID(),
        projectId,
        keyword,
      })),
    );
    // Without metrics the table renders every column as "–".
    await db.insert(schema.keywordMetrics).values(
      SAVED_KEYWORDS.map((row) => ({
        projectId,
        keyword: row.keyword,
        locationCode: 2840,
        languageCode: "en",
        searchVolume: row.volume,
        cpc: row.cpc,
        competition: row.competition,
        keywordDifficulty: row.difficulty,
        intent: row.intent,
        fetchedAt: isoTimestamp(now, -6),
      })),
    );
    console.log(`Saved ${SAVED_KEYWORDS.length} keywords with metrics.`);

    console.log("\nDone. View it:");
    console.log("  env AUTH_MODE=local_noauth pnpm dev");
    console.log("  → Opportunities, Saved Keywords");
  } finally {
    await dispose();
  }
}

/** Bootstraps the same user/org/Default project AUTH_MODE=local_noauth uses. */
async function resolveProject(db: SeedDb): Promise<string> {
  await db
    .insert(schema.user)
    .values({
      id: LOCAL_ADMIN_USER_ID,
      name: "admin",
      email: LOCAL_ADMIN_EMAIL,
      emailVerified: true,
    })
    .onConflictDoNothing({ target: schema.user.id });

  await db
    .insert(schema.organization)
    .values({
      id: LOCAL_ORG_ID,
      name: "admin workspace",
      slug: `delegated-admin-${LOCAL_ADMIN_USER_ID}`,
      createdAt: new Date(),
    })
    .onConflictDoNothing({ target: schema.organization.id });

  const existing = await db.query.projects.findFirst({
    where: and(
      eq(schema.projects.organizationId, LOCAL_ORG_ID),
      eq(schema.projects.name, "Default"),
    ),
  });
  if (existing) return existing.id;

  const projectId = crypto.randomUUID();
  await db.insert(schema.projects).values({
    id: projectId,
    organizationId: LOCAL_ORG_ID,
    name: "Default",
    domain: DOMAIN,
  });
  console.log("Bootstrapped local_noauth Default project.");
  return projectId;
}

function isoDate(from: Date, dayOffset: number) {
  const date = new Date(from);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

function isoTimestamp(from: Date, hourOffset: number) {
  const date = new Date(from);
  date.setUTCHours(date.getUTCHours() + hourOffset);
  return date.toISOString();
}

await main();
