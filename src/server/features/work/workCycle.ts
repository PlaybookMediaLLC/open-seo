import { sort } from "remeda";
import { urlJoinKey } from "@/server/features/opportunities/services/detectors/shared";
import type { WORK_APPROVALS, WORK_SECTIONS } from "@/db/work.schema";

// RFC-0018 5.3 and 5.4: one week of work from real records only. Next has
// no quota: it holds only items that pass every hard filter, at most 5.
const OPEN = new Set(["discovered", "reviewed", "approved"]);
const DAY_MS = 86_400_000;
const EVIDENCE_DAYS = 14;
const MIN_CONFIDENCE = 0.4;
const COOL_DOWN_DAYS = 28;
const NEGATIVE_DAYS = 180;
const NEXT_LIMIT = 5;
const WAIT_APPROVAL_DAYS = 3;
const WAIT_PR_DAYS = 7;
const DATA_DAYS = 7;
const MAX_REASONS = 1_000;

type Experiment = {
  id: string;
  opportunityType: string;
  title: string;
  targetUrl: string;
  createdAt: string;
  pullRequestState: string;
  mergedAt: string | null;
  deployedAt: string | null;
  deploymentBasis: string | null;
  observationEnd: string | null;
  windowComplete: boolean;
  outcome: string | null;
};
export type CycleInput = {
  /** The week, as UTC instants; `weekEnd` is exclusive. */
  weekStart: string;
  weekEnd: string;
  now: Date;
  bar: number;
  openPrLimit: number;
  githubConnected: boolean;
  latestDetectionAt: string | null;
  opportunities: Array<{
    id: string;
    type: string;
    url: string;
    title: string;
    explanation: string;
    status: string;
    confidence: number;
    priority: number;
    effortHours: number;
    lastDetectedAt: string;
  }>;
  experiments: Experiment[];
  splitTests: Array<{
    id: string;
    name: string;
    status: string;
    deployedAt: string | null;
    deploymentBasis: string | null;
    observationEnd: string | null;
  }>;
  /** The latest unexecuted proposal of each approved item. */
  proposals: Array<{
    id: string;
    opportunityId: string;
    title: string;
    createdAt: string;
    approved: boolean;
  }>;
};
type Link =
  | { opportunityId: string }
  | { proposalId: string }
  | { experimentId: string }
  | { splitTestId: string };
export type CycleEntry = {
  section: (typeof WORK_SECTIONS)[number];
  rank: number;
  link: Link;
  title: string;
  reason: string;
  effortHours: number | null;
  approvalNeeded: (typeof WORK_APPROVALS)[number];
};

const daysBetween = (from: string, to: Date) =>
  Math.floor((to.getTime() - Date.parse(from)) / DAY_MS);
const firstSentence = (text: string) =>
  (/^.*?[.!?](?:\s|$)/.exec(text)?.[0] ?? text).trim().slice(0, 300);
const sameUrl = (a: string, b: string) =>
  (urlJoinKey(a) ?? a) === (urlJoinKey(b) ?? b);

export function buildCycle(input: CycleInput) {
  const { now } = input;
  const today = now.toISOString().slice(0, 10);
  const entries: CycleEntry[] = [];
  const add = (
    section: CycleEntry["section"],
    items: Array<Omit<CycleEntry, "section" | "rank">>,
  ) =>
    items.forEach((item, rank) =>
      entries.push({ section, rank, ...item, title: item.title.slice(0, 200) }),
    );
  const inWeek = (at: string | null) =>
    at !== null && at >= input.weekStart && at < input.weekEnd;

  // Completed: merged, and deployed with a verified or attested deployment.
  add("completed", [
    ...input.experiments
      .filter(
        (item) =>
          item.mergedAt && item.deploymentBasis && inWeek(item.deployedAt),
      )
      .map((item) => ({
        link: { experimentId: item.id },
        title: item.title,
        reason: `Merged, and deployed on ${item.deployedAt?.slice(0, 10)} (${item.deploymentBasis === "verified" ? "verified" : "attested"}).`,
        effortHours: null,
        approvalNeeded: "none" as const,
      })),
    ...input.splitTests
      .filter((item) => item.deploymentBasis && inWeek(item.deployedAt))
      .map((item) => ({
        link: { splitTestId: item.id },
        title: `Split test: ${item.name}`,
        reason: `Deployed on ${item.deployedAt?.slice(0, 10)}.`,
        effortHours: null,
        approvalNeeded: "none" as const,
      })),
  ]);

  // Measuring: deployed changes inside their windows, without a label yet.
  const measuring = input.experiments.filter(
    (item) =>
      item.deployedAt !== null &&
      !item.windowComplete &&
      (item.observationEnd === null || item.observationEnd >= today),
  );
  const daysLeft = (end: string | null) =>
    end
      ? `${Math.max(0, Math.ceil((Date.parse(end) - now.getTime()) / DAY_MS))} days left. Results arrive on ${end}.`
      : "Waiting for the measurement window to start.";
  add("measuring", [
    ...measuring.map((item) => ({
      link: { experimentId: item.id },
      title: item.title,
      reason: daysLeft(item.observationEnd),
      effortHours: null,
      approvalNeeded: "none" as const,
    })),
    ...input.splitTests
      .filter(
        (item) => item.status === "running" || item.status === "verifying",
      )
      .map((item) => ({
        link: { splitTestId: item.id },
        title: `Split test: ${item.name}`,
        reason: daysLeft(item.observationEnd),
        effortHours: null,
        approvalNeeded: "none" as const,
      })),
  ]);

  // Waiting on you: old unapproved proposals and old open pull requests.
  const openPrs = input.experiments.filter(
    (item) => item.pullRequestState === "open",
  );
  add("waiting", [
    ...input.proposals
      .filter(
        (item) =>
          !item.approved &&
          daysBetween(item.createdAt, now) > WAIT_APPROVAL_DAYS,
      )
      .map((item) => ({
        link: { proposalId: item.id },
        title: item.title,
        reason: `Prepared ${daysBetween(item.createdAt, now)} days ago. Review and approve the exact change.`,
        effortHours: null,
        approvalNeeded: "approve_change" as const,
      })),
    ...openPrs
      .filter((item) => daysBetween(item.createdAt, now) > WAIT_PR_DAYS)
      .map((item) => ({
        link: { experimentId: item.id },
        title: item.title,
        reason: `The pull request has been open for ${daysBetween(item.createdAt, now)} days. Review and merge it in GitHub.`,
        effortHours: null,
        approvalNeeded: "merge" as const,
      })),
  ]);

  // Next: every hard filter, then priority order, at most 5.
  const excluded = {
    stale: 0,
    lowConfidence: 0,
    belowBar: 0,
    bestBelow: 0,
    coolingDown: 0,
    negative: 0,
    setup: 0,
  };
  const resultDates: string[] = [];
  const candidates = input.opportunities.filter((item) =>
    OPEN.has(item.status),
  );
  const passed = candidates.filter((item) => {
    if (daysBetween(item.lastDetectedAt, now) > EVIDENCE_DAYS) {
      excluded.stale++;
      return false;
    }
    if (item.confidence < MIN_CONFIDENCE) {
      excluded.lowConfidence++;
      return false;
    }
    if (item.priority < input.bar) {
      excluded.belowBar++;
      excluded.bestBelow = Math.max(excluded.bestBelow, item.priority);
      return false;
    }
    const busy = input.experiments.filter(
      (change) =>
        sameUrl(change.targetUrl, item.url) &&
        change.deployedAt !== null &&
        (daysBetween(change.deployedAt, now) <= COOL_DOWN_DAYS ||
          measuring.includes(change)),
    );
    if (busy.length) {
      excluded.coolingDown++;
      resultDates.push(
        ...busy.flatMap((change) => change.observationEnd ?? []),
      );
      return false;
    }
    if (
      input.experiments.some(
        (change) =>
          sameUrl(change.targetUrl, item.url) &&
          change.opportunityType === item.type &&
          change.outcome === "negative" &&
          daysBetween(change.createdAt, now) <= NEGATIVE_DAYS,
      )
    ) {
      excluded.negative++;
      return false;
    }
    if (!input.githubConnected) {
      excluded.setup++;
      return false;
    }
    return true;
  });
  const full = openPrs.length >= input.openPrLimit;
  const next = sort(passed, (a, b) => b.priority - a.priority).slice(
    0,
    NEXT_LIMIT,
  );
  add(
    "next",
    next.map((item) => ({
      link: { opportunityId: item.id },
      title: item.title,
      reason: full
        ? `Ready after current changes merge: ${openPrs.length} Relay pull requests are open, and the limit is ${input.openPrLimit}.`
        : firstSentence(item.explanation),
      effortHours: item.effortHours,
      approvalNeeded:
        item.status === "approved"
          ? ("approve_change" as const)
          : ("review" as const),
    })),
  );

  const reasons: string[] = [];
  const codes: string[] = [];
  const because = (code: string, text: string) => {
    codes.push(code);
    reasons.push(text);
  };
  if (next.length < NEXT_LIMIT) {
    if (!candidates.length)
      because("no_items", "The latest detection found no open items.");
    if (excluded.stale)
      because(
        "stale",
        `${excluded.stale} items have evidence older than ${EVIDENCE_DAYS} days. Relay waits for a new detection run.`,
      );
    if (excluded.lowConfidence)
      because(
        "low_confidence",
        `${excluded.lowConfidence} items have a confidence below ${MIN_CONFIDENCE}.`,
      );
    if (excluded.belowBar)
      because(
        "below_bar",
        `The best other candidate scored ${excluded.bestBelow}. The bar is ${input.bar}.`,
      );
    if (excluded.coolingDown) {
      const [first] = sort(resultDates, (a, b) => a.localeCompare(b));
      because(
        "cooling_down",
        `${excluded.coolingDown} items are on pages that changed in the last ${COOL_DOWN_DAYS} days or are measuring.${first ? ` Results arrive on ${first}.` : ""}`,
      );
    }
    if (excluded.negative)
      because(
        "negative",
        `${excluded.negative} items repeat a change that had a negative result on the same page in the last ${NEGATIVE_DAYS} days.`,
      );
    if (excluded.setup)
      because("setup", `Connect GitHub to prepare ${excluded.setup} changes.`);
    if (
      input.latestDetectionAt &&
      daysBetween(input.latestDetectionAt, now) > DATA_DAYS
    )
      because(
        "old_data",
        `The latest detection is ${daysBetween(input.latestDetectionAt, now)} days old. Relay waits for complete data.`,
      );
  }
  return {
    entries,
    emptyReasons: reasons.join(" ").slice(0, MAX_REASONS),
    reasonCodes: codes,
  };
}
