import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CardShell } from "@/client/components/CardShell";
import { QueryState } from "@/client/components/QueryState";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import {
  getPublishingApprovers,
  savePublishingApprovers,
} from "@/serverFunctions/approvals";

type Approvers = Awaited<ReturnType<typeof getPublishingApprovers>>;

// RFC-0007 6.5: who may approve this project's pull requests. Owners change
// the list; everyone else reads it.
export function PublishingApproversCard({ projectId }: { projectId: string }) {
  const query = useQuery({
    queryKey: ["publishing", projectId, "approvers"],
    queryFn: () => getPublishingApprovers({ data: { projectId } }),
  });
  return (
    <CardShell title="Pull request approvers">
      <QueryState query={query} errorFallback="Could not load the approvers">
        {(data) => (
          <ApproverList
            key={data.members
              .map((row) => `${row.memberId}:${row.listed}`)
              .join()}
            projectId={projectId}
            data={data}
          />
        )}
      </QueryState>
    </CardShell>
  );
}

function ApproverList({
  projectId,
  data,
}: {
  projectId: string;
  data: Approvers;
}) {
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState(
    () =>
      new Set(data.members.filter((row) => row.listed).map((r) => r.memberId)),
  );
  const save = useMutation({
    mutationFn: (memberIds: string[]) =>
      savePublishingApprovers({ data: { projectId, memberIds } }),
    onSuccess: () => {
      toast.success("Approvers saved");
      void queryClient.invalidateQueries({
        queryKey: ["publishing", projectId],
      });
    },
  });
  const listed = data.members.filter((row) => row.listed);
  const changed =
    chosen.size !== listed.length ||
    listed.some((row) => !chosen.has(row.memberId));
  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        {data.restricted
          ? "Only owners and the members checked below approve pull requests for this project."
          : "Owners and the members they allow in organization settings approve pull requests for this project. Check members to limit approval here to them; owners always approve."}
      </p>
      {!data.canApprove ? (
        <p role="status">You can't approve pull requests for this project.</p>
      ) : null}
      <ul className="divide-y rounded-lg border">
        {data.members.map((row) => (
          <li
            key={row.memberId}
            className="flex items-center justify-between gap-3 p-3"
          >
            <label className="flex min-w-0 items-center gap-3">
              <Checkbox
                checked={chosen.has(row.memberId)}
                disabled={!data.canManage || save.isPending}
                onCheckedChange={(checked) =>
                  setChosen((current) => {
                    const next = new Set(current);
                    if (checked) next.add(row.memberId);
                    else next.delete(row.memberId);
                    return next;
                  })
                }
              />
              <span className="min-w-0">
                <span className="block truncate font-medium" data-ph-mask>
                  {row.name || row.email}
                </span>
                <span
                  className="block truncate text-xs text-muted-foreground"
                  data-ph-mask
                >
                  {row.email}
                </span>
              </span>
            </label>
            <span className="shrink-0 text-xs text-muted-foreground">
              {row.isOwner
                ? "Owner, always approves"
                : row.approves
                  ? "Approves"
                  : "Doesn't approve"}
            </span>
          </li>
        ))}
      </ul>
      {data.canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!changed}
            pending={save.isPending}
            onClick={() => save.mutate([...chosen])}
          >
            Save approvers
          </Button>
          {data.restricted ? (
            <Button
              size="sm"
              variant="outline"
              disabled={save.isPending}
              onClick={() => save.mutate([])}
            >
              Let every approver approve
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground">
          Only an owner can change who approves.
        </p>
      )}
    </div>
  );
}
