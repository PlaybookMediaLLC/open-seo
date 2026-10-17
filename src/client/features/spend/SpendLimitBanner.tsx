import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AppBanner } from "@/client/layout/AppBanner";
import { BILLING_ROUTE } from "@/shared/billing";
import { projectSpendQuery } from "./ProjectSpending";
import { credits } from "./spendParts";

const share = (use: { committed: number; limit: number }) =>
  use.limit > 0 ? use.committed / use.limit : Infinity;
const linkClass = "font-medium text-primary underline-offset-4 hover:underline";

/** RFC-0009 5.5: a banner once 80% of a limit is committed. */
export function SpendLimitBanner({ projectId }: { projectId: string }) {
  const spend = useQuery({
    ...projectSpendQuery(projectId),
    staleTime: 60_000,
  });
  const fullest = spend.data?.uses
    .filter((use) => share(use) >= 0.8)
    .reduce<
      (typeof spend.data.uses)[number] | undefined
    >((best, use) => (!best || share(use) > share(best) ? use : best), undefined);
  if (!fullest) return null;
  const reached = fullest.committed >= fullest.limit;
  const scope =
    fullest.scope === "project" ? "This project" : "Your organization";
  return (
    <AppBanner variant={reached ? "destructive" : "warning"}>
      {scope} {reached ? "reached" : "is close to"} its monthly credit limit (
      {credits(fullest.committed)} of {credits(fullest.limit)} credits).{" "}
      {reached ? "Paid actions are paused. " : ""}
      {fullest.scope === "project" ? (
        <Link
          to="/p/$projectId/settings/spending"
          params={{ projectId }}
          className={linkClass}
        >
          Spending settings
        </Link>
      ) : (
        <Link to={BILLING_ROUTE} className={linkClass}>
          Billing
        </Link>
      )}
    </AppBanner>
  );
}
