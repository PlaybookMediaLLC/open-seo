import { causesOf, METRIC_NAMES, metricValue } from "@/shared/performance";
import type { PerformanceEvidence } from "@/types/schemas/opportunities";

/** RFC-0014: the field data, lab value and causes of a performance issue. */
export function performanceRows(
  evidence: PerformanceEvidence,
): Array<[string, string]> {
  const { metric } = evidence;
  const causes = causesOf(evidence.causeIds);
  return [
    ["Metric", METRIC_NAMES[metric]],
    [
      "75th percentile",
      `${metricValue(metric, evidence.p75Value)} on ${evidence.formFactor === "phone" ? "phones" : "desktops"}`,
    ],
    ["Good", `${metricValue(metric, evidence.threshold)} or less`],
    [
      "Pages",
      evidence.template === "*"
        ? "Pages without their own field data"
        : `Pages like ${evidence.template}`,
    ],
    [
      "Measured on",
      `${evidence.target}${evidence.scope === "origin" ? " (the whole site)" : ""}`,
    ],
    ["28 days to", evidence.collectionEnd],
    [
      "Lighthouse lab value",
      evidence.labValue === null
        ? "No Lighthouse report"
        : metricValue(metric, evidence.labValue),
    ],
    [
      "Causes",
      causes.length
        ? causes.map((cause) => cause.label).join("; ")
        : "None named. Run a site audit with Lighthouse.",
    ],
  ];
}
