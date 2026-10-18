import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { creditFeatureLabel } from "@/shared/billing-credit-features";
import {
  getOrganizationSpend,
  saveOrganizationLimit,
} from "@/serverFunctions/spendLimits";
import { credits, LimitSheet, LimitUsage } from "./spendParts";

// Ledger features that are not Autumn credit features.
const LEDGER_LABELS: Record<string, string> = {
  proposal_draft: "AI drafts",
  ai_research: "AI research",
};
const featureLabel = (feature: string | null) =>
  feature ? (LEDGER_LABELS[feature] ?? creditFeatureLabel(feature)) : "Other";

/** RFC-0009 5.5: the Billing page's limit and this month's spend. */
export function SpendLimitsCard() {
  const client = useQueryClient();
  const spend = useQuery({
    queryKey: ["spend", "organization"],
    queryFn: () => getOrganizationSpend(),
  });
  const save = useMutation({
    mutationFn: (monthlyLimitCredits: number | null) =>
      saveOrganizationLimit({ data: { monthlyLimitCredits } }),
    onSuccess: () => {
      setEditing(false);
      return client.invalidateQueries({ queryKey: ["spend"] });
    },
  });
  const [editing, setEditing] = useState(false);
  if (!spend.data) return null;
  const { limit, committed, canManage, projects, features } = spend.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending limit</CardTitle>
        <CardDescription>
          A monthly cap on credits for the whole organization. Each project can
          also have its own limit in its settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <LimitUsage committed={committed} limit={limit} />
          </div>
          {canManage && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              Edit limit
            </Button>
          )}
        </div>
        {projects.some((row) => row.committed > 0 || row.limit !== null) && (
          <table className="w-full text-sm">
            <caption className="sr-only">Committed credits by project</caption>
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Project</th>
                <th className="py-1 text-right font-medium">This month</th>
                <th className="py-1 text-right font-medium">Limit</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {projects
                .filter((row) => row.committed > 0 || row.limit !== null)
                .map((row) => (
                  <tr key={row.id}>
                    <td className="py-1">{row.name}</td>
                    <td className="py-1 text-right tabular-nums">
                      {credits(row.committed)}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {row.limit === null ? "None" : credits(row.limit)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
        {features.length > 0 && (
          <p className="text-xs text-muted-foreground">
            By feature:{" "}
            {features
              .map(
                (row) =>
                  `${featureLabel(row.feature)} ${credits(row.committed)}`,
              )
              .join(" · ")}
          </p>
        )}
      </CardContent>
      {editing && (
        <LimitSheet
          title="Organization spending limit"
          limit={limit}
          pending={save.isPending}
          onSave={(next) => save.mutate(next)}
          onClose={() => setEditing(false)}
        />
      )}
    </Card>
  );
}
