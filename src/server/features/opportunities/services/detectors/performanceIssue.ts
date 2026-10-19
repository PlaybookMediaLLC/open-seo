import { sort } from "remeda";
import type {
  FieldSnapshot,
  LabPage,
  PerformanceSignals,
} from "@/server/features/performance/performanceSignals";
import { detectUrlTemplate } from "@/server/lib/audit/url-utils";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import {
  FIELD_DATA_LIMITS,
  GOOD,
  METRIC_NAMES,
  metricValue,
  PERFORMANCE_METRICS,
  type PerformanceMetric,
} from "@/shared/performance";
import type { OpportunityCandidate } from "@/types/schemas/opportunities";
import { priorityFor, type ScoringContext } from "./scoreCandidate";
import { bounded, compareText, urlJoinKey, urlLandingPageKey } from "./shared";

// RFC-0014 5.3: one item per route template and failing metric. A template
// is measured on its most-visited page that has field data. Templates with
// no page-level data share one site-wide item per metric, from the origin,
// so one slow origin does not become one item per template.
const CONFIDENCE = 0.6;
const EFFORT_HOURS = 4;
const DIFFICULTY = 0.5;
const SITE = "*";

type Member = { key: string; url: string; clicks: number };

const fieldValue = (snapshot: FieldSnapshot, metric: PerformanceMetric) =>
  metric === "lcp"
    ? snapshot.lcpP75Ms
    : metric === "inp"
      ? snapshot.inpP75Ms
      : snapshot.clsP75;
const labValue = (page: LabPage, metric: PerformanceMetric) =>
  metric === "lcp" ? page.lcpMs : metric === "inp" ? page.inpMs : page.cls;

/** Phones first: Google indexes the mobile page. */
const measured = (snapshots: FieldSnapshot[]) =>
  snapshots.find((snapshot) => snapshot.formFactor === "phone") ?? snapshots[0];

const roleScore = (role: string | undefined) =>
  role === "money"
    ? 1
    : role === "hub"
      ? 0.7
      : role === "spoke" || role === "other"
        ? 0.5
        : 0.25;

export function performanceIssues(
  signals: PerformanceSignals,
  currentPages: GscSearchAnalyticsRow[],
  keyPages: Array<{ url: string }>,
  context: ScoringContext,
): OpportunityCandidate[] {
  const byPage = new Map<string, FieldSnapshot[]>();
  const origin: FieldSnapshot[] = [];
  for (const snapshot of signals.field) {
    if (snapshot.scope === "origin") origin.push(snapshot);
    const key = snapshot.scope === "url" && urlJoinKey(snapshot.target);
    if (key) byPage.set(key, [...(byPage.get(key) ?? []), snapshot]);
  }
  // The pages that matter: organic clicks or a key-page role.
  const pages = new Map<string, Member>();
  for (const row of currentPages) {
    const url = row.keys?.[0];
    const key = url && urlJoinKey(url);
    if (key && row.clicks > 0) pages.set(key, { key, url, clicks: row.clicks });
  }
  for (const { url } of keyPages) {
    const key = urlJoinKey(url);
    if (key && !pages.has(key)) pages.set(key, { key, url, clicks: 0 });
  }
  const templates = new Map<string, Member[]>();
  for (const page of pages.values()) {
    const path = URL.parse(page.url)?.pathname;
    if (!path) continue;
    const template = detectUrlTemplate(path);
    templates.set(template, [...(templates.get(template) ?? []), page]);
  }
  const roles = new Map(
    [...context.roles].map(([url, role]) => [urlJoinKey(url), role]),
  );
  const candidates: OpportunityCandidate[] = [];
  const unmeasured: Member[] = [];

  const failing = (
    template: string,
    members: Member[],
    snapshot: FieldSnapshot,
    url: string,
  ) => {
    const keys = new Set(members.map((member) => member.key));
    // The measured page's own report first, then mobile reports.
    const lab = sort(
      signals.lab.filter((page) => keys.has(urlJoinKey(page.url) ?? "")),
      (a, b) =>
        Number(urlJoinKey(b.url) === urlJoinKey(url)) -
          Number(urlJoinKey(a.url) === urlJoinKey(url)) ||
        Number(b.strategy === "mobile") - Number(a.strategy === "mobile"),
    );
    const clicks = members.reduce((total, member) => total + member.clicks, 0);
    const keyEvents = members.reduce(
      (total, member) =>
        total +
        (context.ga4
          ?.get(urlLandingPageKey(member.url))
          ?.find((row) => row.period === "current")?.keyEvents ?? 0),
      0,
    );
    const commercialScore = Math.max(
      ...members.map((member) => roleScore(roles.get(member.key))),
      keyEvents >= 10 ? 1 : keyEvents >= 1 ? 0.7 : 0,
    );
    const where = template === SITE ? "the site" : `pages like ${template}`;
    for (const metric of PERFORMANCE_METRICS) {
      const value = fieldValue(snapshot, metric);
      const threshold = GOOD[metric];
      if (value === null || value <= threshold) continue;
      const causes = [...new Set(lab.flatMap((page) => page.causes))].filter(
        (cause) => cause.metrics.some((item) => item === metric),
      );
      const scores = {
        commercialScore,
        demandScore: bounded(Math.log10(1 + clicks) / 5),
        visibilityScore: Math.min(value / threshold, 2) - 1,
        difficultyScore: DIFFICULTY,
        effortScore: bounded(1 / EFFORT_HOURS),
      };
      const priority = priorityFor(CONFIDENCE, scores);
      const users = snapshot.formFactor === "phone" ? "phones" : "desktops";
      candidates.push({
        type: "performance_issue",
        url,
        query: null,
        title: `Improve ${METRIC_NAMES[metric]} on ${where} for ${users}`,
        explanation: `Real Chrome users on ${users} see a ${METRIC_NAMES[metric]} of ${metricValue(metric, value)} at the 75th percentile, over the 28 days to ${snapshot.collectionEnd}. Good is ${metricValue(metric, threshold)} or less.${snapshot.scope === "origin" ? " These pages have too few Chrome users for page-level data, so this is the value of the whole site." : ""}${causes.length ? ` The latest Lighthouse report names: ${causes.map((cause) => cause.label).join("; ")}.` : ""} ${FIELD_DATA_LIMITS}`,
        recommendedAction: causes.length
          ? causes.map((cause) => cause.fix).join(" ")
          : "Run a site audit with Lighthouse on this page to name the cause.",
        searchIntent: "Not applicable; field data from the Chrome UX Report",
        confidence: CONFIDENCE,
        effortHours: EFFORT_HOURS,
        priority,
        ...scores,
        scoreExplanation: `Priority = round(100 × confidence ${CONFIDENCE} × (0.30 × commercial ${commercialScore} + 0.25 × demand ${scores.demandScore} + 0.20 × visibility ${scores.visibilityScore} + 0.15 × (1 - difficulty ${DIFFICULTY}) + 0.10 × inverse effort ${scores.effortScore})) = ${priority}. Commercial is the best key-page role or GA4 conversions of these pages. Demand = min(1, log10(1 + ${clicks} organic clicks) / 5). Visibility = min(p75 / good, 2) - 1.`,
        uncertainty: `${FIELD_DATA_LIMITS} Clicks count only the pages that Search Console reports.`,
        diagnosis: null,
        evidence: [],
        urls: [],
        ga4: [],
        performance: {
          template,
          metric,
          formFactor: snapshot.formFactor,
          p75Value: value,
          threshold,
          scope: snapshot.scope,
          target: snapshot.target,
          collectionEnd: snapshot.collectionEnd,
          labValue: lab[0] ? labValue(lab[0], metric) : null,
          causeIds: causes.map((cause) => cause.id).join(" "),
        },
      });
    }
  };

  for (const [template, members] of sort([...templates], ([a], [b]) =>
    compareText(a, b),
  )) {
    const sorted = sort(
      members,
      (a, b) => b.clicks - a.clicks || compareText(a.url, b.url),
    );
    const page = sorted.find((member) => byPage.has(member.key));
    if (page)
      failing(template, sorted, measured(byPage.get(page.key)!), page.url);
    else unmeasured.push(...sorted);
  }
  const site = measured(origin);
  if (unmeasured.length && site) failing(SITE, unmeasured, site, site.target);
  return candidates;
}
