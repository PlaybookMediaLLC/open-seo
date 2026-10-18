import { useMutation } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { Button } from "@/client/components/ui/button";
import { backtestSplitTest } from "@/serverFunctions/splitTests";

// RFC-0011 phase 3: how this test would have behaved on the site's own
// history, with no change and with a +15% lift.
const percent = (value: number) => `${Math.round(value * 100)}%`;

export function SplitTestBacktestCard(props: {
  projectId: string;
  testId: string;
}) {
  const run = useMutation({
    mutationFn: () => backtestSplitTest({ data: props }),
  });
  return (
    <CardShell
      title="Backtest on your data"
      action={
        <Button
          size="sm"
          variant="outline"
          pending={run.isPending}
          onClick={() => run.mutate()}
        >
          Run backtest
        </Button>
      }
    >
      <div className="space-y-2 text-sm">
        {run.data?.runs === 0 ? (
          <p>Too few pages with clicks in this window to backtest.</p>
        ) : run.data ? (
          <>
            <p>
              On your data from {run.data.start} to {run.data.end}, the 90%
              interval excluded 0 in {percent(run.data.falsePositiveRate)} of{" "}
              {run.data.runs} runs with no change. About 10% is expected; more
              than 12% means this group gives too many false results.
            </p>
            <p>
              A +15% lift was labeled positive in{" "}
              {percent(run.data.liftDetectedRate)} of {run.data.runs} runs.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">
            Relay replays the test on the 91 days before its baseline, with new
            random groups each time. It makes one Search Console request and
            changes nothing.
          </p>
        )}
        {run.isError && (
          <p role="alert" className="text-destructive">
            {run.error.message}
          </p>
        )}
      </div>
    </CardShell>
  );
}
