import { sort } from "remeda";

// RFC-0018 5.7: the month's work from records, with every negative result.
type Outcome = "encouraging" | "inconclusive" | "negative";
type ReportInput = {
  changes: Array<{
    experimentId: string;
    title: string;
    targetUrl: string;
    deployedAt: string;
    deploymentBasis: string;
    approver: string | null;
    effortHours: number;
  }>;
  results: Array<{
    experimentId: string;
    title: string;
    outcome: Outcome;
    explanation: string;
    /** Conversions in the baseline and observation windows, from GA4. */
    conversions: { baseline: number; observation: number } | null;
  }>;
  /** When each change approved this month was prepared and approved. */
  approvals: Array<{ preparedAt: string; approvedAt: string }>;
  waiting: number;
};

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = sort(values, (a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function workReport(input: ReportInput) {
  const count = (outcome: Outcome) =>
    input.results.filter((result) => result.outcome === outcome).length;
  const hours = input.approvals.map(
    (item) =>
      (Date.parse(item.approvedAt) - Date.parse(item.preparedAt)) / 3_600_000,
  );
  const medianHours = median(hours);
  return {
    changes: input.changes,
    effortHours: input.changes.reduce((sum, item) => sum + item.effortHours, 0),
    results: {
      encouraging: count("encouraging"),
      inconclusive: count("inconclusive"),
      negative: count("negative"),
      // Negative results first, so they are never left out of a short view.
      items: sort(input.results, (a, b) =>
        a.outcome === b.outcome
          ? 0
          : a.outcome === "negative"
            ? -1
            : b.outcome === "negative"
              ? 1
              : 0,
      ),
    },
    approvals: {
      count: input.approvals.length,
      medianHours:
        medianHours === null ? null : Math.round(medianHours * 10) / 10,
      waiting: input.waiting,
    },
  };
}
