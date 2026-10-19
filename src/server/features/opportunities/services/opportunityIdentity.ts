import { sort } from "remeda";
import type { OpportunityCandidate } from "@/types/schemas/opportunities";

/** RFC-0002 5.4: the tuple that names one opportunity across runs. */
function identityTuple(
  projectId: string,
  siteUrl: string,
  candidate: OpportunityCandidate,
) {
  // Single-URL types keep the original tuple, so their hashes never change.
  const base = [projectId, siteUrl, candidate.type];
  switch (candidate.type) {
    case "cannibalization":
      return [
        ...base,
        sort(
          candidate.urls.map((item) => item.url),
          (a, b) => (a < b ? -1 : a > b ? 1 : 0),
        ),
      ];
    case "technical_blocker":
      return [...base, candidate.url, candidate.audit?.issueType ?? null];
    case "internal_link":
      return [...base, candidate.url, candidate.link?.sourceUrl ?? null];
    case "content_gap":
      return [...base, candidate.topic ?? null];
    case "accessibility_issue":
      return [...base, candidate.accessibility?.clusterKey ?? null];
    case "performance_issue":
      return [
        ...base,
        candidate.performance?.template ?? null,
        candidate.performance?.metric ?? null,
      ];
    default:
      return [...base, candidate.url, candidate.query];
  }
}

/**
 * Adds a SHA-256 identity hash to each candidate. The structured tuple
 * prevents ambiguous delimiters. This is an identity hash, not a store of
 * relational data; evidence lives in separate normalized rows.
 */
export function withIdentityKeys<T extends OpportunityCandidate>(
  projectId: string,
  siteUrl: string,
  candidates: T[],
) {
  return Promise.all(
    candidates.map(async (candidate) => {
      const bytes = new TextEncoder().encode(
        JSON.stringify(identityTuple(projectId, siteUrl, candidate)),
      );
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const identityKey = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      return { ...candidate, identityKey };
    }),
  );
}
