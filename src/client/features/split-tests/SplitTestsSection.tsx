import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { QueryError } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import { Textarea } from "@/client/components/ui/textarea";
import { dateLabel } from "@/client/features/opportunities/shared";
import {
  backtestSplitTestPattern,
  createSplitTest,
  listSplitTests,
} from "@/serverFunctions/splitTests";

// RFC-0011 5.9: recent split tests first; the new-test form is a sheet.
const splitTestKeys = (projectId: string) =>
  ["split-tests", projectId] as const;

export function SplitTestsSection({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: splitTestKeys(projectId),
    queryFn: () => listSplitTests({ data: { projectId } }),
  });
  return (
    <CardShell
      title="Split tests"
      action={
        query.data?.canManage ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            New split test
          </Button>
        ) : undefined
      }
    >
      {query.isPending ? (
        <p className="text-sm text-muted-foreground">Loading split tests…</p>
      ) : query.isError ? (
        <QueryError
          fallback="Could not load split tests"
          onRetry={() => void query.refetch()}
        />
      ) : query.data.tests.length ? (
        <ul className="divide-y text-sm">
          {query.data.tests.map((test) => (
            <li
              key={test.id}
              className="flex flex-wrap items-center gap-3 py-2"
            >
              <Link
                className="font-medium hover:underline"
                to="/p/$projectId/experiments/split-tests/$testId"
                params={{ projectId, testId: test.id }}
              >
                {test.name}
              </Link>
              <code className="text-xs">{test.pagePattern}</code>
              <Badge variant="outline">
                {test.status.replaceAll("_", " ")}
              </Badge>
              <span className="ml-auto text-xs text-muted-foreground">
                {dateLabel(test.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          A split test changes a random half of one template&apos;s pages and
          estimates the effect against the other half.
        </p>
      )}
      {open && (
        <NewSplitTestSheet
          projectId={projectId}
          onClose={() => setOpen(false)}
        />
      )}
    </CardShell>
  );
}

const FIELDS = [
  { value: "title", label: "Title" },
  { value: "description", label: "Meta description" },
  { value: "other", label: "Something else" },
] as const;

function NewSplitTestSheet(props: { projectId: string; onClose: () => void }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [field, setField] = useState<(typeof FIELDS)[number]["value"]>("title");
  const [pagePattern, setPagePattern] = useState("^/");
  const create = useMutation({
    mutationFn: () =>
      createSplitTest({
        data: {
          projectId: props.projectId,
          name,
          hypothesis,
          field,
          pagePattern,
        },
      }),
    onSuccess: async (result) => {
      await client.invalidateQueries({
        queryKey: splitTestKeys(props.projectId),
      });
      if (result.created)
        await navigate({
          to: "/p/$projectId/experiments/split-tests/$testId",
          params: { projectId: props.projectId, testId: result.testId },
        });
    },
  });
  const refused = create.data && !create.data.created ? create.data : null;
  const backtest = useMutation({
    mutationFn: () =>
      backtestSplitTestPattern({
        data: { projectId: props.projectId, pagePattern },
      }),
  });
  return (
    <Sheet open onOpenChange={(next) => !next && props.onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>New split test</SheetTitle>
          <SheetDescription>
            Relay lists the matching pages from Search Console, checks that they
            share one template, and splits them into two balanced groups.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 text-sm">
          <Input
            aria-label="Name"
            placeholder="Integration titles name the product"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Textarea
            aria-label="Hypothesis"
            placeholder="Titles that name the product get more clicks."
            value={hypothesis}
            onChange={(event) => setHypothesis(event.target.value)}
          />
          <select
            aria-label="Field to change"
            className="h-9 w-full rounded-md border bg-background px-2"
            value={field}
            onChange={(event) =>
              setField(
                FIELDS.find((option) => option.value === event.target.value)
                  ?.value ?? "title",
              )
            }
          >
            {FIELDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Input
            aria-label="Page pattern"
            placeholder="^/integrations/[^/]+$"
            value={pagePattern}
            onChange={(event) => setPagePattern(event.target.value)}
          />
          {create.isError && (
            <p role="alert" className="text-destructive">
              {create.error.message}
            </p>
          )}
          {refused && (
            <div role="alert" className="space-y-1 rounded-md border p-3">
              <p className="font-medium">This group cannot run a test.</p>
              {refused.failures.map((failure) => (
                <p key={failure}>{failure}</p>
              ))}
              {refused.summary && (
                <p className="text-muted-foreground">{refused.summary}</p>
              )}
              {backtest.data?.runs === 0 ? (
                <p className="text-muted-foreground">
                  Too few pages with clicks to backtest ({backtest.data.pairs}{" "}
                  pairs).
                </p>
              ) : backtest.data ? (
                <p className="text-muted-foreground">
                  Backtest of {backtest.data.pairs} pairs from{" "}
                  {backtest.data.start} to {backtest.data.end}: the 90% interval
                  excluded 0 in{" "}
                  {Math.round(backtest.data.falsePositiveRate * 100)}% of{" "}
                  {backtest.data.runs} runs with no change, and a +15% lift was
                  labeled positive in{" "}
                  {Math.round(backtest.data.liftDetectedRate * 100)}%.
                </p>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  pending={backtest.isPending}
                  onClick={() => backtest.mutate()}
                >
                  Run a backtest anyway
                </Button>
              )}
              {backtest.isError && (
                <p className="text-destructive">{backtest.error.message}</p>
              )}
            </div>
          )}
        </div>
        <SheetFooter>
          <Button
            pending={create.isPending}
            disabled={
              !name.trim() || !hypothesis.trim() || pagePattern.length < 3
            }
            onClick={() => create.mutate()}
          >
            Check and create
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
