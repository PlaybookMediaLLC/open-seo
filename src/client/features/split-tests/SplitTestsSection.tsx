import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { QueryError } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Label } from "@/client/components/ui/label";
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
  previewSplitTestPattern,
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
  const [metric, setMetric] = useState<"clicks" | "conversions">("clicks");
  const create = useMutation({
    mutationFn: () =>
      createSplitTest({
        data: {
          projectId: props.projectId,
          name,
          hypothesis,
          field,
          pagePattern,
          metric,
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
  const preview = useMutation({
    mutationFn: () =>
      previewSplitTestPattern({
        data: { projectId: props.projectId, pagePattern },
      }),
  });
  const currentPreview =
    preview.data?.pattern === pagePattern.trim() ? preview.data : null;
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
          <Label htmlFor="split-name">Name</Label>
          <Input
            id="split-name"
            aria-label="Name"
            placeholder="Integration titles name the product"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Label htmlFor="split-hypothesis">Hypothesis</Label>
          <Textarea
            id="split-hypothesis"
            aria-label="Hypothesis"
            placeholder="Titles that name the product get more clicks."
            value={hypothesis}
            onChange={(event) => setHypothesis(event.target.value)}
          />
          <Label htmlFor="split-field">Field to change</Label>
          <select
            id="split-field"
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
          <Label htmlFor="split-metric">Metric</Label>
          <select
            id="split-metric"
            aria-label="Metric"
            className="h-9 w-full rounded-md border bg-background px-2"
            value={metric}
            onChange={(event) =>
              setMetric(
                event.target.value === "conversions" ? "conversions" : "clicks",
              )
            }
          >
            <option value="clicks">Measure clicks from search</option>
            <option value="conversions">
              Measure the chosen conversion (GA4)
            </option>
          </select>
          <Label htmlFor="split-pattern">Page pattern</Label>
          <Input
            id="split-pattern"
            aria-label="Page pattern"
            aria-describedby="split-pattern-help"
            placeholder="^/integrations/[^/]+$"
            value={pagePattern}
            onChange={(event) => setPagePattern(event.target.value)}
          />
          <p id="split-pattern-help" className="text-sm text-muted-foreground">
            Match URL paths with a regular expression. For example,{" "}
            <code>^/integrations/[^/]+$</code> includes{" "}
            <code>/integrations/slack</code> and excludes{" "}
            <code>/blog/slack</code>. Check the matching pages before creating a
            test.
          </p>
          <Button
            variant="outline"
            pending={preview.isPending}
            disabled={pagePattern.trim().length < 3}
            onClick={() => preview.mutate()}
          >
            Preview matching pages
          </Button>
          {preview.isError && (
            <QueryError
              error={preview.error}
              fallback="Could not preview matching pages"
            />
          )}
          {currentPreview && (
            <div className="space-y-2 rounded-lg border p-3">
              <p>
                {currentPreview.total} matching pages in Search Console,{" "}
                {currentPreview.window.start} to {currentPreview.window.end}.
                Showing up to 20. No test or site change has been created.
              </p>
              <ul className="max-h-48 overflow-auto space-y-1">
                {currentPreview.pages.map((page) => (
                  <li key={page.url} className="break-all">
                    {page.url} · {page.clicks} clicks
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground">
                Only pages present in this baseline are listed. Creating the
                test rechecks eligibility.
              </p>
            </div>
          )}
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
              !name.trim() ||
              !hypothesis.trim() ||
              !currentPreview ||
              currentPreview.total === 0
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
