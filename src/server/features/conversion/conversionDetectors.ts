import { sort } from "remeda";
import { priorityFor } from "@/server/features/opportunities/services/detectors/scoreCandidate";
import {
  bounded,
  urlJoinKey,
} from "@/server/features/opportunities/services/detectors/shared";
import type {
  Ga4LandingPageMetrics,
  OpportunityCandidate,
} from "@/types/schemas/opportunities";

// RFC-0012 5.3: four conversion detectors over 28 days of GA4 data. Medians
// use the pages that meet the session floor, so a few small pages cannot
// set them.
const MIN_SESSIONS = 300;
const LOW_RATE_SHARE = 0.5;
const MIN_GAP = 5;
const MIN_FORM_STARTS = 50;
const MAX_FORM_SUBMIT_RATE = 0.3;
const MIN_MOBILE_SESSIONS = 200;
const DEVICE_SHARE = 0.5;
const LOW_ENGAGEMENT = 0.4;
const SITE_ENGAGEMENT = 0.55;
const CONFIDENCE = 0.5;
const EFFORT_HOURS = 2;
const DIFFICULTY = 0.5;

type Visits = { sessions: number; conversions: number };
export type ConversionPage = Visits & {
  hostName: string;
  landingPage: string;
  engagedSessions: number;
  mobile: Visits;
  desktop: Visits;
  /** Form events on the page. Null when GA4 records none. */
  forms: { starts: number; submits: number } | null;
};
export type ConversionInput = {
  pages: ConversionPage[];
  /** Key-page role by URL join key. */
  roles: Map<string, string>;
  eventName: string;
  valueMinor: number | null;
  currency: string | null;
  channel: "organic_search" | "all";
  formsMeasured: boolean;
};

const rate = (visits: Visits) =>
  visits.sessions ? visits.conversions / visits.sessions : 0;
const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;
function median(values: number[]) {
  if (!values.length) return null;
  const sorted = sort(values, (a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
const roleScore = (role: string) =>
  role === "money"
    ? 1
    : role === "hub"
      ? 0.7
      : role === "spoke" || role === "other"
        ? 0.5
        : 0.25;

const url = (page: ConversionPage) =>
  `https://${page.hostName}${page.landingPage}`;

export function detectConversionProblems(input: ConversionInput) {
  const roleOf = (page: ConversionPage) =>
    input.roles.get(urlJoinKey(url(page)) ?? "") ?? "unknown";
  const floor = input.pages.filter((page) => page.sessions >= MIN_SESSIONS);
  const roleMedians = new Map<string, number | null>();
  for (const role of new Set(floor.map(roleOf)))
    roleMedians.set(
      role,
      median(floor.filter((page) => roleOf(page) === role).map(rate)),
    );
  const siteEngagement = median(
    floor.map((page) => page.engagedSessions / page.sessions),
  );
  const channelText =
    input.channel === "organic_search" ? "organic search" : "all channels";

  const candidate = (
    type: Extract<OpportunityCandidate["type"], `cro_${string}`>,
    page: ConversionPage,
    facts: {
      title: string;
      explanation: string;
      recommendedAction: string;
      visibility: number;
      visibilityRule: string;
    },
  ): OpportunityCandidate => {
    const role = roleOf(page);
    const roleMedian = roleMedians.get(role) ?? null;
    const more =
      roleMedian === null
        ? 0
        : Math.round(roleMedian * page.sessions - page.conversions);
    const amount =
      input.valueMinor !== null && input.currency
        ? ` (about ${new Intl.NumberFormat("en-US", { style: "currency", currency: input.currency }).format((more * input.valueMinor) / 100)})`
        : "";
    const value =
      more > 0
        ? ` If this page converted at the site median for its role, it would get about ${more} more conversions in 28 days${amount}. This is not a forecast.`
        : "";
    const commercialScore = input.valueMinor !== null ? 1 : roleScore(role);
    const demandScore = bounded(Math.log10(1 + page.sessions) / 4);
    const visibilityScore = bounded(facts.visibility);
    const effortScore = bounded(1 / EFFORT_HOURS);
    const scores = {
      commercialScore,
      demandScore,
      visibilityScore,
      difficultyScore: DIFFICULTY,
      effortScore,
    };
    const priority = priorityFor(CONFIDENCE, scores);
    const evidence = (
      device: Ga4LandingPageMetrics["device"],
      visits: Visits,
    ): Ga4LandingPageMetrics => ({
      period: "current",
      landingPage: page.landingPage,
      sessions: visits.sessions,
      keyEvents: visits.conversions,
      revenue: null,
      currency: input.currency,
      device,
      engagedSessions: device === "all" ? page.engagedSessions : null,
      keyEventName: input.eventName,
      formStarts: device === "all" ? (page.forms?.starts ?? null) : null,
      formSubmits: device === "all" ? (page.forms?.submits ?? null) : null,
    });
    return {
      type,
      url: url(page),
      query: null,
      title: facts.title,
      explanation: `${facts.explanation} The data is ${channelText} traffic in the last 28 days.${value}`,
      recommendedAction: facts.recommendedAction,
      searchIntent: "Not applicable; conversion evidence from GA4",
      confidence: CONFIDENCE,
      effortHours: EFFORT_HOURS,
      priority,
      ...scores,
      scoreExplanation: `Priority = round(100 × confidence ${CONFIDENCE} × (0.30 × commercial ${commercialScore} + 0.25 × demand ${demandScore} + 0.20 × visibility ${visibilityScore} + 0.15 × (1 - difficulty ${DIFFICULTY}) + 0.10 × inverse effort ${effortScore})) = ${priority}. Commercial is ${input.valueMinor !== null ? "1, because each conversion has a value" : `the page role score ${commercialScore} (${role})`}. Demand = min(1, log10(1 + ${page.sessions} sessions) / 4). Visibility = ${facts.visibilityRule}. Difficulty is a neutral 0.5, because no ranking applies. Effort is an estimate of ${EFFORT_HOURS} hours.`,
      uncertainty:
        "GA4 reports are aggregated and can be sampled or thresholded. Conversions count only what the tracking records. Priority is a review heuristic, not a conversion forecast.",
      diagnosis: null,
      evidence: [],
      urls: [],
      ga4:
        type === "cro_device_gap"
          ? [
              evidence("all", page),
              evidence("mobile", page.mobile),
              evidence("desktop", page.desktop),
            ]
          : [evidence("all", page)],
    };
  };

  const found: OpportunityCandidate[] = [];
  for (const page of input.pages) {
    const roleMedian = roleMedians.get(roleOf(page)) ?? null;
    const pageRate = rate(page);
    if (
      page.sessions >= MIN_SESSIONS &&
      roleMedian &&
      pageRate <= LOW_RATE_SHARE * roleMedian &&
      roleMedian * page.sessions - page.conversions >= MIN_GAP
    )
      found.push(
        candidate("cro_low_conversion", page, {
          title: "Improve a page that converts below the site median",
          explanation: `${page.sessions} sessions gave ${page.conversions} ${input.eventName} conversions (${percent(pageRate)}). The median for pages with the same role is ${percent(roleMedian)}.`,
          recommendedAction:
            "Check that the headline and the call to action match the searches that bring visitors. Propose one copy change, then measure it.",
          visibility: 1 - pageRate / roleMedian,
          visibilityRule: `1 - page rate ${percent(pageRate)} / role median ${percent(roleMedian)}`,
        }),
      );
    const forms = page.forms;
    if (
      input.formsMeasured &&
      forms &&
      forms.starts >= MIN_FORM_STARTS &&
      forms.submits / forms.starts <= MAX_FORM_SUBMIT_RATE
    ) {
      const submitRate = forms.submits / forms.starts;
      found.push(
        candidate("cro_form_drop_off", page, {
          title: "Fix a form that few visitors submit",
          explanation: `${forms.starts} visitors started the form and ${forms.submits} submitted it (${percent(submitRate)}).`,
          recommendedAction:
            "Check the form labels, the error text and the number of fields. Propose a text change, then measure it.",
          visibility: 1 - submitRate / MAX_FORM_SUBMIT_RATE,
          visibilityRule: `1 - submit rate ${percent(submitRate)} / ${percent(MAX_FORM_SUBMIT_RATE)}`,
        }),
      );
    }
    const mobileRate = rate(page.mobile);
    const desktopRate = rate(page.desktop);
    if (
      page.mobile.sessions >= MIN_MOBILE_SESSIONS &&
      desktopRate > 0 &&
      mobileRate <= DEVICE_SHARE * desktopRate
    )
      found.push(
        candidate("cro_device_gap", page, {
          title: "Fix the mobile conversion gap on a page",
          explanation: `Mobile converts at ${percent(mobileRate)} (${page.mobile.conversions} of ${page.mobile.sessions} sessions), and desktop at ${percent(desktopRate)} (${page.desktop.conversions} of ${page.desktop.sessions}).`,
          recommendedAction:
            "Open the page on a phone. Check that the call to action and the form are visible and easy to use. Propose one change, then measure it.",
          visibility: 1 - mobileRate / desktopRate,
          visibilityRule: `1 - mobile rate ${percent(mobileRate)} / desktop rate ${percent(desktopRate)}`,
        }),
      );
    const engagement = page.sessions ? page.engagedSessions / page.sessions : 0;
    if (
      page.sessions >= MIN_SESSIONS &&
      siteEngagement !== null &&
      siteEngagement >= SITE_ENGAGEMENT &&
      engagement <= LOW_ENGAGEMENT
    )
      found.push(
        candidate("cro_low_engagement", page, {
          title: "Improve a page that visitors leave quickly",
          explanation: `${percent(engagement)} of ${page.sessions} sessions were engaged. The site median is ${percent(siteEngagement)}.`,
          recommendedAction:
            "Check that the first screen answers the search that brought the visitor. Propose one copy change, then measure it.",
          visibility: 1 - engagement / siteEngagement,
          visibilityRule: `1 - engagement ${percent(engagement)} / site median ${percent(siteEngagement)}`,
        }),
      );
  }
  return sort(found, (a, b) => b.priority - a.priority).slice(0, 50);
}
