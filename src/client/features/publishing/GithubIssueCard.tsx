import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Label } from "@/client/components/ui/label";
import {
  createGithubIssue,
  getGithubIssuePreview,
} from "@/serverFunctions/publishing";

// A GitHub issue from the approved opportunity. Relay creates it only after
// the person approves this exact text, and one approval makes one issue.
export function GithubIssueCard({
  projectId,
  opportunityId,
  repository,
}: {
  projectId: string;
  opportunityId: string;
  repository: string;
}) {
  const [approved, setApproved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const preview = useQuery({
    queryKey: ["publishing", projectId, "issue", opportunityId],
    queryFn: () =>
      getGithubIssuePreview({ data: { projectId, opportunityId } }),
  });
  const create = useMutation({
    meta: { errorToast: false },
    mutationFn: (textHash: string) =>
      createGithubIssue({
        data: { projectId, opportunityId, textHash, confirmExactText: true },
      }),
    onSuccess: (result) => setMessage(result.message),
    onError: () => setMessage("Could not create the issue."),
    onSettled: () => preview.refetch(),
  });
  const data = preview.data;
  if (!data) return null;
  return (
    <CardShell title="GitHub issue">
      <div className="space-y-3 text-sm">
        {data.ticket?.issueUrl ? (
          <p>
            Issue #{data.ticket.issueNumber} exists for this text.{" "}
            <a href={data.ticket.issueUrl} className="underline">
              Open it in GitHub
            </a>
          </p>
        ) : (
          <>
            <p className="text-muted-foreground">
              Relay creates this issue in {repository} only after you approve
              this exact text. It adds a hidden marker to find the issue again.
            </p>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-medium">{data.title}</p>
              <pre className="mt-2 whitespace-pre-wrap break-words text-xs">
                {data.body}
              </pre>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`issue-approve-${opportunityId}`}
                checked={approved}
                onCheckedChange={(checked) => setApproved(checked)}
              />
              <Label htmlFor={`issue-approve-${opportunityId}`}>
                I approve this exact text
              </Label>
            </div>
            <Button
              size="sm"
              disabled={!approved}
              pending={create.isPending}
              onClick={() => {
                setMessage(null);
                create.mutate(data.textHash);
              }}
            >
              Create GitHub issue
            </Button>
          </>
        )}
        {message && <p role="status">{message}</p>}
      </div>
    </CardShell>
  );
}
