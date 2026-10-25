import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CardShell } from "@/client/components/CardShell";
import { Button } from "@/client/components/ui/button";
import {
  getProjectSpend,
  saveProjectLimit,
} from "@/serverFunctions/spendLimits";
import { useCreditBalance } from "@/client/features/billing/useCreditBalance";
import { isHostedClientAuthMode } from "@/lib/auth-mode";
import { QueryError } from "@/client/components/QueryState";
import {
  AUTUMN_SEO_DATA_CREDITS_PER_USD,
  BILLING_ROUTE,
} from "@/shared/billing";
import { credits, LimitSheet, LimitUsage } from "./spendParts";

export const projectSpendQuery = (projectId: string) => ({
  queryKey: ["spend", "project", projectId],
  queryFn: () => getProjectSpend({ data: { projectId } }),
});

/** RFC-0009 5.5: the project's monthly limit and this month's spend. */
export function ProjectSpending({ projectId }: { projectId: string }) {
  const client = useQueryClient();
  const balance = useCreditBalance();
  const spend = useQuery(projectSpendQuery(projectId));
  const save = useMutation({
    mutationFn: (monthlyLimitCredits: number | null) =>
      saveProjectLimit({ data: { projectId, monthlyLimitCredits } }),
    onSuccess: () => {
      setEditing(false);
      return client.invalidateQueries({ queryKey: ["spend"] });
    },
  });
  const [editing, setEditing] = useState(false);
  if (!spend.data) return null;
  const { committed, limit, canManage, uses } = spend.data;
  const organization = uses.find((use) => use.scope === "organization");
  return (
    <CardShell
      title="Monthly spending limit"
      action={
        canManage ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
          >
            Edit limit
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {isHostedClientAuthMode() && (
          <div className="border-b pb-3 text-sm">
            <p className="font-medium">Available organization balance</p>
            {balance.accountQuery.data ? (
              <p>
                {credits(
                  balance.totalRemaining * AUTUMN_SEO_DATA_CREDITS_PER_USD,
                )}{" "}
                credits (${balance.totalRemaining.toFixed(2)}), shared by all
                projects.
              </p>
            ) : balance.accountQuery.isError ? (
              <QueryError
                error={balance.accountQuery.error}
                fallback="Could not load the credit balance"
              />
            ) : (
              <p role="status">Loading balance…</p>
            )}
            <p className="mt-1 text-muted-foreground">
              The project limit caps monthly usage. It does not add credits to
              your balance. Actions must fit both the available balance and the
              remaining limits.
            </p>
          </div>
        )}
        <LimitUsage committed={committed} limit={limit} />
        {organization && (
          <p className="text-sm text-muted-foreground">
            The organization limit also applies:{" "}
            {credits(organization.committed)} of {credits(organization.limit)}{" "}
            credits committed. See{" "}
            <Link
              to={BILLING_ROUTE}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Billing
            </Link>
            .
          </p>
        )}
        {!canManage && (
          <p className="text-xs text-muted-foreground">
            Only the organization owner can change a limit.
          </p>
        )}
      </div>
      {editing && (
        <LimitSheet
          title="Project spending limit"
          limit={limit}
          pending={save.isPending}
          onSave={(next) => save.mutate(next)}
          onClose={() => setEditing(false)}
        />
      )}
    </CardShell>
  );
}
