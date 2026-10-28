import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { Button } from "@/client/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import {
  endSplitTest,
  previewSplitTestEnd,
  type getSplitTest,
} from "@/serverFunctions/splitTests";

// RFC-0011 5.7: apply the change to all pages, or remove the test. Both
// open a reviewed pull request that leaves no split code.
type Data = Awaited<ReturnType<typeof getSplitTest>>;
type Action = "apply" | "remove";
const DEPLOYED = new Set(["verifying", "running", "stopped", "concluded"]);

export function SplitTestEndCard({ data }: { data: Data }) {
  const { test, analysis } = data;
  const [action, setAction] = useState<Action | null>(null);
  if (!data.canApprove || !DEPLOYED.has(test.status)) return null;
  const canApply =
    test.status === "concluded" && analysis?.label !== "negative";
  return (
    <CardShell title="End the test">
      <div className="space-y-3 text-sm">
        {test.endPullRequestUrl ? (
          <p>
            <a
              className="font-medium hover:underline"
              href={test.endPullRequestUrl}
              target="_blank"
              rel="noreferrer"
            >
              {test.endAction === "apply"
                ? "Pull request that applies the change"
                : "Pull request that removes the test"}
            </a>
          </p>
        ) : (
          <>
            <p className="text-muted-foreground">
              {analysis?.label === "positive"
                ? "The estimated effect is positive. You can apply the variant to every page."
                : analysis?.label === "negative" || test.status === "stopped"
                  ? "Remove the test and keep the current values."
                  : test.status === "concluded"
                    ? "No effect larger than the MDE was found. Apply the variant or remove the test."
                    : "You can remove the test at any time. A positive result needs the full window."}
            </p>
            <div className="flex flex-wrap gap-2">
              {canApply && (
                <Button size="sm" onClick={() => setAction("apply")}>
                  Apply to all pages
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAction("remove")}
              >
                Remove test
              </Button>
            </div>
          </>
        )}
      </div>
      {action && (
        <EndSheet
          ids={{ projectId: test.projectId, testId: test.id }}
          action={action}
          onClose={() => setAction(null)}
        />
      )}
    </CardShell>
  );
}

function EndSheet(props: {
  ids: { projectId: string; testId: string };
  action: Action;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const preview = useQuery({
    queryKey: [
      "split-tests",
      props.ids.projectId,
      props.ids.testId,
      props.action,
    ],
    queryFn: () =>
      previewSplitTestEnd({ data: { ...props.ids, action: props.action } }),
  });
  const end = useMutation({
    mutationFn: (hash: string) =>
      endSplitTest({ data: { ...props.ids, action: props.action, hash } }),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ["split-tests", props.ids.projectId],
      });
      props.onClose();
    },
  });
  const problems = preview.data?.problems ?? [];
  return (
    <Sheet open onOpenChange={(next) => !next && props.onClose()}>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {props.action === "apply" ? "Apply to all pages" : "Remove test"}
          </SheetTitle>
          <SheetDescription>
            Relay opens one pull request with exactly this change.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 overflow-auto px-4 text-sm">
          {preview.isPending && <p>Loading…</p>}
          {preview.isError && (
            <p role="alert" className="text-destructive">
              {preview.error.message}
            </p>
          )}
          {problems.map((problem) => (
            <p key={problem} role="alert">
              {problem}
            </p>
          ))}
          {preview.data && !problems.length && (
            <>
              <p className="font-medium">{preview.data.templatePath} after</p>
              <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
                {preview.data.after}
              </pre>
              <p>Deleted: {preview.data.deleted.join(", ") || "nothing"}</p>
            </>
          )}
          {end.isError && (
            <p role="alert" className="text-destructive">
              {end.error.message}
            </p>
          )}
        </div>
        <SheetFooter>
          <Button
            pending={end.isPending}
            disabled={!preview.data || problems.length > 0}
            onClick={() => preview.data && end.mutate(preview.data.hash)}
          >
            Approve and open
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
