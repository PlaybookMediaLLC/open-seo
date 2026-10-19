import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { dateLabel } from "@/client/features/opportunities/shared";
import { measureDocsResult } from "@/serverFunctions/docs";

/** RFC-0017 5.7: site searches for the topic, 4 weeks before and after. */
export function DocsResult(props: { projectId: string; experimentId: string }) {
  const measure = useMutation({
    meta: { errorToast: false },
    mutationFn: () => measureDocsResult({ data: props }),
  });
  const result = measure.data;
  return (
    <section
      className="rounded-xl border bg-card p-5 space-y-3 text-sm"
      aria-label="Docs search result"
    >
      <h2 className="text-lg font-semibold">Docs search result</h2>
      <p className="text-muted-foreground">
        Relay compares GA4 site searches for the topic in the 4 weeks before and
        the 4 weeks after the deployment. Search Console clicks and position for
        the page are in the measurement above.
      </p>
      <Button
        variant="outline"
        pending={measure.isPending}
        onClick={() => measure.mutate()}
      >
        Measure searches
      </Button>
      {result?.status === "not_deployed" && (
        <p>Confirm the deployment first.</p>
      )}
      {result?.status === "no_term" && (
        <p>This item has no search term, so there is no search result.</p>
      )}
      {result?.status === "no_ga4" && (
        <p>Connect Google Analytics to measure site searches.</p>
      )}
      {result?.status === "waiting" && (
        <p>
          Searches for &quot;{result.term}&quot; can be measured on{" "}
          {dateLabel(result.readyOn)}.
        </p>
      )}
      {result?.status === "measured" && (
        <>
          <p className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{result.label}</Badge>
            &quot;{result.term}&quot;: {result.before.searches} searches before,{" "}
            {result.after.searches} after. {result.reason}
          </p>
          <p className="text-xs text-muted-foreground">
            {result.before.startDate} to {result.before.endDate} against{" "}
            {result.after.startDate} to {result.after.endDate}.
          </p>
        </>
      )}
      {measure.isError && (
        <p role="alert" className="text-destructive">
          {measure.error.message}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Product changes, launches and seasons also move searches and traffic. A
        result is an observation, not proof that the docs change caused it.
      </p>
    </section>
  );
}
