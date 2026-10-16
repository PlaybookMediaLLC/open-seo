import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { getProjectContext } from "@/serverFunctions/projectContext";
import {
  checkLiveSerp,
  estimateContentGaps,
  estimateLiveSerpCheck,
  findContentGaps,
} from "@/serverFunctions/opportunities";
import { opportunityKeys } from "./shared";

const MAX_COMPETITORS = 3;

/** RFC-0002 phase 3: pick competitors, see the cost, then confirm. */
export function ContentGapSheet({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [domains, setDomains] = React.useState<string[]>([]);
  const competitors = useQuery({
    queryKey: ["project-context", projectId, "competitors"],
    queryFn: () => getProjectContext({ data: { projectId } }),
    select: (context) => context.competitors.map((item) => item.domain),
    enabled: open,
  });
  const estimate = useQuery({
    queryKey: [...opportunityKeys.all(projectId), "content-gap-cost", domains],
    queryFn: () => estimateContentGaps({ data: { projectId, domains } }),
    enabled: open && domains.length > 0,
    staleTime: 0,
  });
  const run = useMutation({
    mutationFn: (confirmedCredits: number) =>
      findContentGaps({ data: { projectId, domains, confirmedCredits } }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: opportunityKeys.all(projectId),
      });
      if (result.outcome === "completed") {
        toast.success(result.message);
        setOpen(false);
      } else toast.error(result.message);
    },
  });
  const toggle = (domain: string, checked: boolean) =>
    setDomains((current) =>
      checked
        ? [...current, domain].slice(0, MAX_COMPETITORS)
        : current.filter((item) => item !== domain),
    );
  const credits = estimate.data?.totalCredits;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Find content gaps
      </Button>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Find content gaps</SheetTitle>
          <SheetDescription>
            Relay buys each competitor's top-10 keywords from DataForSEO and
            finds commercial topics where your site barely appears. Data is
            saved for 30 days, so a repeat run with the same competitor is free.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4">
          <p className="text-sm font-medium">
            Competitors (up to {MAX_COMPETITORS})
          </p>
          {competitors.data?.length ? (
            competitors.data.map((domain) => (
              <label key={domain} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={domains.includes(domain)}
                  disabled={
                    !domains.includes(domain) &&
                    domains.length >= MAX_COMPETITORS
                  }
                  onCheckedChange={(checked) => toggle(domain, checked)}
                />
                {domain}
              </label>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {competitors.isPending
                ? "Loading competitors…"
                : "Add competitors on the project Context page first."}
            </p>
          )}
          {estimate.data ? (
            <ul className="space-y-1 rounded-lg bg-muted p-3 text-sm">
              {estimate.data.domains.map((item) => (
                <li key={item.domain} className="flex justify-between gap-4">
                  <span className="break-all">{item.domain}</span>
                  <span>
                    {item.cached
                      ? "Saved data, free"
                      : `${item.credits} credits`}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <SheetFooter>
          <Button
            disabled={credits === undefined || estimate.isFetching}
            pending={run.isPending}
            onClick={() => credits !== undefined && run.mutate(credits)}
          >
            {credits === undefined
              ? "Pick competitors"
              : `Find content gaps · ${credits} credits`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** RFC-0002 phase 3: a paid live results check for one low click-through page. */
export function LiveSerpCheckSheet({
  projectId,
  opportunityId,
}: {
  projectId: string;
  opportunityId: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const estimate = useQuery({
    queryKey: [
      ...opportunityKeys.detail(projectId, opportunityId),
      "serp-cost",
    ],
    queryFn: () =>
      estimateLiveSerpCheck({ data: { projectId, opportunityId } }),
    enabled: open,
    staleTime: 0,
  });
  const check = useMutation({
    mutationFn: (confirmedCredits: number) =>
      checkLiveSerp({ data: { projectId, opportunityId, confirmedCredits } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: opportunityKeys.all(projectId),
      });
      toast.success("Live results checked");
      setOpen(false);
    },
  });
  const credits = estimate.data?.credits;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Check live results
      </Button>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Check live results</SheetTitle>
          <SheetDescription>
            Relay buys one live Google results page for the page's top query.
            Ads, an AI overview or a featured snippet above your page lower
            confidence by 0.15. None of them raise it by 0.10. The check is
            reused for 24 hours.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 text-sm">
          {estimate.data ? (
            <p>
              Query:{" "}
              <span className="font-medium">{estimate.data.keyword}</span>
              {estimate.data.cached
                ? " · Checked in the last 24 hours, so this is free."
                : ` · ${estimate.data.credits} credits`}
            </p>
          ) : (
            <p className="text-muted-foreground">Loading the cost…</p>
          )}
        </div>
        <SheetFooter>
          <Button
            disabled={credits === undefined}
            pending={check.isPending}
            onClick={() => credits !== undefined && check.mutate(credits)}
          >
            {credits ? `Check · ${credits} credits` : "Check"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
