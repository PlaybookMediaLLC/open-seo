import { useQuery } from "@tanstack/react-query";
import { CopyButton } from "@/client/components/CopyButton";
import { Button } from "@/client/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/client/components/ui/sheet";
import { getWebVitalsReport } from "@/serverFunctions/performance";
import { GOOD_SHARE, VITALS_SNIPPET } from "@/shared/performance";

const percent = (value: number | null) =>
  value === null
    ? "—"
    : `${Math.round(value * 100)}%${value >= GOOD_SHARE ? " (passes)" : ""}`;

/** RFC-0014 5.7: Web Vitals from the optional snippet, read from GA4. */
export function WebVitalsCard({ projectId }: { projectId: string }) {
  const query = useQuery({
    queryKey: ["web-vitals", projectId],
    queryFn: () => getWebVitalsReport({ data: { projectId } }),
    staleTime: 3_600_000,
  });
  const report = query.data;
  return (
    <section
      className="rounded-xl border bg-card p-4 space-y-2 text-sm"
      aria-label="Web Vitals from Google Analytics"
    >
      <h2 className="font-medium">Web Vitals from your snippet</h2>
      {report?.status === "ready" ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-4 font-medium">Page</th>
                  <th className="py-1 pr-4 font-medium">Loads</th>
                  <th className="py-1 pr-4 font-medium">LCP good</th>
                  <th className="py-1 pr-4 font-medium">INP good</th>
                  <th className="py-1 font-medium">CLS good</th>
                </tr>
              </thead>
              <tbody>
                {report.pages.map((page) => (
                  <tr key={page.pagePath} className="border-t">
                    <td className="py-1 pr-4 break-all">{page.pagePath}</td>
                    <td className="py-1 pr-4">{page.loads}</td>
                    <td className="py-1 pr-4">{percent(page.good.lcp)}</td>
                    <td className="py-1 pr-4">{percent(page.good.inp)}</td>
                    <td className="py-1">{percent(page.good.cls)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            The share of page loads that the snippet rated good, over the 28
            days to {report.endDate}. A metric passes at 75% or more, the same
            test as a good 75th percentile.
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">
          {report?.status === "not_connected"
            ? "Connect Google Analytics in Project settings to read the snippet's events."
            : "No Web Vitals events yet. For pages without Chrome UX Report data, add the snippet to your site."}
        </p>
      )}
      <Sheet>
        <SheetTrigger render={<Button size="sm" variant="outline" />}>
          Set up the snippet
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Web Vitals snippet</SheetTitle>
            <SheetDescription>
              The snippet sends each page load's LCP, INP and CLS to your own
              Google Analytics. Nothing goes to Relay.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 text-sm">
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Add this component to your Next.js app, and render it once in
                the root layout.
              </li>
              <li>
                In Google Analytics, go to Admin, Custom definitions, and create
                an event-scoped custom dimension with the event parameter{" "}
                <code>metric_rating</code>.
              </li>
              <li>Wait a day for the events. Relay then reads them here.</li>
            </ol>
            <pre className="max-h-80 overflow-auto rounded-md border bg-muted p-3 text-xs">
              {VITALS_SNIPPET}
            </pre>
            <CopyButton
              value={VITALS_SNIPPET}
              size="sm"
              label="Copy the snippet"
              successMessage="Snippet copied."
            />
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
