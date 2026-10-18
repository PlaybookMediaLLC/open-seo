import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import {
  checkSplitTestPull,
  confirmSplitTestDeployment,
  openSplitTestPull,
  previewSplitTestPull,
  type getSplitTest,
} from "@/serverFunctions/splitTests";

// RFC-0011 5.4: review and open the pull request, check the final diff,
// then confirm the production deployment.
type Test = Awaited<ReturnType<typeof getSplitTest>>["test"];

export function SplitTestPullCard({ test }: { test: Test }) {
  const client = useQueryClient();
  const ids = { projectId: test.projectId, testId: test.id };
  const [reviewing, setReviewing] = useState(false);
  const [attest, setAttest] = useState(false);
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["split-tests", test.projectId] });
  const check = useMutation({
    mutationFn: () => checkSplitTestPull({ data: ids }),
    onSettled: refresh,
  });
  const confirm = useMutation({
    mutationFn: () => confirmSplitTestDeployment({ data: { ...ids, attest } }),
    onSettled: refresh,
  });
  const problems = test.checkProblems?.split("\n") ?? [];
  return (
    <CardShell title="Pull request">
      <div className="space-y-3 text-sm">
        {test.status === "eligible" && (
          <>
            <p>
              Relay opens one pull request with the variant list and a helper. A
              developer then adds one edit to <code>{test.templatePath}</code>.
            </p>
            <Button size="sm" onClick={() => setReviewing(true)}>
              Review pull request
            </Button>
          </>
        )}
        {test.pullRequestUrl && (
          <p>
            <a
              className="font-medium hover:underline"
              href={test.pullRequestUrl}
              target="_blank"
              rel="noreferrer"
            >
              Pull request #{test.pullRequestNumber}
            </a>
          </p>
        )}
        {test.status === "awaiting_deploy" && (
          <>
            {test.checkedSha && (
              <div role="status" className="rounded-md border p-3">
                <p className="font-medium">
                  {test.checkPassed
                    ? `The final diff passed at ${test.checkedSha.slice(0, 7)}.`
                    : `The diff needs changes at ${test.checkedSha.slice(0, 7)}.`}
                </p>
                {problems.map((problem) => (
                  <p key={problem}>{problem}</p>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                pending={check.isPending}
                onClick={() => check.mutate()}
              >
                Check pull request
              </Button>
              <label className="flex items-center gap-2">
                <Checkbox checked={attest} onCheckedChange={setAttest} />
                It is live in production
              </label>
              <Button
                size="sm"
                pending={confirm.isPending}
                disabled={!test.checkPassed}
                onClick={() => confirm.mutate()}
              >
                Confirm deployment
              </Button>
            </div>
            {confirm.data && !confirm.data.ok && (
              <p role="alert">{confirm.data.message}</p>
            )}
            {(check.isError || confirm.isError) && (
              <p role="alert" className="text-destructive">
                {(check.error ?? confirm.error)?.message}
              </p>
            )}
          </>
        )}
        {test.deployedAt && (
          <p className="text-muted-foreground">
            Deployed {new Date(test.deployedAt).toLocaleDateString()} (
            {test.deploymentBasis === "github_deployment"
              ? "GitHub deployment"
              : "confirmed by an owner"}
            ). Observation {test.observationStart} to {test.observationEnd}.
          </p>
        )}
      </div>
      {reviewing && (
        <ReviewSheet ids={ids} onClose={() => setReviewing(false)} />
      )}
    </CardShell>
  );
}

function ReviewSheet(props: {
  ids: { projectId: string; testId: string };
  onClose: () => void;
}) {
  const client = useQueryClient();
  const preview = useQuery({
    queryKey: ["split-tests", props.ids.projectId, props.ids.testId, "pull"],
    queryFn: () => previewSplitTestPull({ data: props.ids }),
  });
  const open = useMutation({
    mutationFn: (hash: string) =>
      openSplitTestPull({ data: { ...props.ids, hash } }),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ["split-tests", props.ids.projectId],
      });
      props.onClose();
    },
  });
  return (
    <Sheet open onOpenChange={(next) => !next && props.onClose()}>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Review the pull request</SheetTitle>
          <SheetDescription>
            Relay writes exactly these files to a new branch and opens the pull
            request with this description.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 overflow-auto px-4 text-sm">
          {preview.isPending && <p>Loading…</p>}
          {preview.isError && (
            <p role="alert" className="text-destructive">
              {preview.error.message}
            </p>
          )}
          {preview.data && (
            <>
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                {preview.data.body}
              </pre>
              {preview.data.files.map((file) => (
                <div key={file.path}>
                  <p className="font-medium">{file.path}</p>
                  <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                    {file.source}
                  </pre>
                </div>
              ))}
            </>
          )}
          {open.isError && (
            <p role="alert" className="text-destructive">
              {open.error.message}
            </p>
          )}
        </div>
        <SheetFooter>
          <Button
            pending={open.isPending}
            disabled={!preview.data}
            onClick={() => preview.data && open.mutate(preview.data.hash)}
          >
            Approve and open
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
