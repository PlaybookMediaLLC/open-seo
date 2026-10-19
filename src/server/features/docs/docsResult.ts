// RFC-0017 5.7: a direction needs 50 searches in each window and a change of
// 25% or more. Anything less is inconclusive.
const MIN_SEARCHES = 50;
const MIN_CHANGE = 0.25;

export function searchResult(before: number, after: number) {
  if (before < MIN_SEARCHES || after < MIN_SEARCHES)
    return {
      label: "inconclusive" as const,
      reason: `Each window needs ${MIN_SEARCHES} or more searches.`,
    };
  const change = (after - before) / before;
  if (Math.abs(change) < MIN_CHANGE)
    return {
      label: "inconclusive" as const,
      reason: `The change is ${Math.round(change * 100)}%, less than ${MIN_CHANGE * 100}%.`,
    };
  return {
    label:
      change < 0 ? ("fewer searches" as const) : ("more searches" as const),
    reason: `Searches changed by ${Math.round(change * 100)}%.`,
  };
}
