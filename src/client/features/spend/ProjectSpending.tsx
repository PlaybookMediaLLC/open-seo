import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CardShell } from "@/client/components/CardShell";
import { Button } from "@/client/components/ui/button";
import {
  getProjectSpend,
  saveProjectLimit,
} from "@/serverFunctions/spendLimits";
import { BILLING_ROUTE } from "@/shared/billing";
import { credits, LimitSheet, LimitUsage } from "./spendParts";

export const projectSpendQuery = (projectId: string) => ({
  queryKey: ["spend", "project", projectId],
  queryFn: () => getProjectSpend({ data: { projectId } }),
});

/** RFC-0009 5.5: the project's monthly limit and this month's spend. */
export function ProjectSpending({ projectId }: { projectId: string }) {
  const client = useQueryClient();
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
