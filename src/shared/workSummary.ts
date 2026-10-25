/** Pending decisions take precedence over the next-work queue. */
export function workSummary({
  waiting,
  nextTitle,
  emptyReasons,
}: {
  waiting: number;
  nextTitle?: string;
  emptyReasons?: string | null;
}) {
  if (waiting)
    return `${waiting} item${waiting === 1 ? " needs" : "s need"} your review.`;
  if (nextTitle) return `Next: ${nextTitle}`;
  return (
    emptyReasons ||
    "No new work is ready. Review your sources and existing work."
  );
}
