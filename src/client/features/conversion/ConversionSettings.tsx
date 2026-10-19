import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CardShell } from "@/client/components/CardShell";
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
import { StripeConnection } from "@/client/features/revenue/StripeConnection";
import {
  getConversionGate,
  saveConversionEvent,
} from "@/serverFunctions/conversion";

const conversionQuery = (projectId: string) => ({
  queryKey: ["conversion", projectId],
  queryFn: () => getConversionGate({ data: { projectId } }),
});

type Data = Awaited<ReturnType<typeof getConversionGate>>;
const CHECK_LABELS: Record<string, string> = {
  web_stream: "GA4 has a web data stream",
  key_event: "GA4 has at least one key event",
  volume: "The conversion has at least 30 events in 28 days",
  chosen: "A key event is chosen as the conversion",
};

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    minor / 100,
  );

/** RFC-0012 5.2: the tracking gate first, then the chosen conversion. */
export function ConversionSettings({ projectId }: { projectId: string }) {
  const query = useQuery(conversionQuery(projectId));
  const [editing, setEditing] = useState(false);
  if (!query.data) return null;
  const { gate, conversion, canManage } = query.data;
  return (
    <div className="space-y-6">
      <CardShell
        title="Tracking gate"
        action={
          gate.status === "passed" ? (
            <Badge>Passed</Badge>
          ) : gate.status === "failed" ? (
            <Badge variant="destructive">Not ready</Badge>
          ) : undefined
        }
      >
        {gate.status === "not_connected" ? (
          <p className="text-sm text-muted-foreground">
            Connect Google Analytics in{" "}
            <Link
              to="/p/$projectId/settings/integrations"
              params={{ projectId }}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Integrations
            </Link>{" "}
            first. Relay finds conversion problems from GA4 data only.
          </p>
        ) : gate.status === "error" ? (
          <p className="text-sm text-destructive">{gate.message}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {gate.checks.map((check) => (
              <li key={check.id}>
                <span className={check.ok ? "" : "font-medium"}>
                  {check.ok ? "✓" : "✗"} {CHECK_LABELS[check.id]}
                </span>
                {check.fix && (
                  <p className="text-muted-foreground">{check.fix}</p>
                )}
              </li>
            ))}
            {!gate.formsMeasured && (
              <li className="text-muted-foreground">
                GA4 enhanced measurement does not record form interactions, so
                Relay skips the form drop-off check. Turn on &quot;Form
                interactions&quot; in GA4: Admin &gt; Data streams.
              </li>
            )}
            {gate.status === "failed" && (
              <li className="text-muted-foreground">
                Relay creates no conversion opportunity until every check
                passes.
              </li>
            )}
          </ul>
        )}
      </CardShell>
      <CardShell
        title="Conversion"
        action={
          canManage &&
          (gate.status === "passed" || gate.status === "failed") ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              {conversion ? "Change" : "Choose"}
            </Button>
          ) : undefined
        }
      >
        {conversion ? (
          <p className="text-sm">
            <code>{conversion.eventName}</code>
            {conversion.valueMinor !== null && conversion.currency
              ? `, worth ${money(conversion.valueMinor, conversion.currency)} each`
              : ", with no value set"}
            {conversion.channel === "all"
              ? ". Checks use all traffic."
              : ". Checks use organic search traffic."}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No conversion chosen yet.
            {!canManage && " An owner or admin chooses it."}
          </p>
        )}
      </CardShell>
      {editing && (gate.status === "passed" || gate.status === "failed") && (
        <ConversionSheet
          projectId={projectId}
          gate={gate}
          conversion={conversion}
          onClose={() => setEditing(false)}
        />
      )}
      <StripeConnection projectId={projectId} />
    </div>
  );
}

function ConversionSheet(props: {
  projectId: string;
  gate: Extract<Data["gate"], { keyEvents: unknown }>;
  conversion: Data["conversion"];
  onClose: () => void;
}) {
  const { gate, conversion } = props;
  const client = useQueryClient();
  const [eventName, setEventName] = useState(
    conversion?.eventName ?? gate.keyEvents[0]?.eventName ?? "",
  );
  const [channel, setChannel] = useState(
    conversion?.channel ?? "organic_search",
  );
  const [value, setValue] = useState(
    conversion?.valueMinor != null ? String(conversion.valueMinor / 100) : "",
  );
  const save = useMutation({
    mutationFn: () => {
      const amount = value.trim() ? Math.round(Number(value) * 100) : null;
      return saveConversionEvent({
        data: {
          projectId: props.projectId,
          eventName,
          valueMinor: amount,
          currency: amount === null ? null : gate.currency,
          channel,
        },
      });
    },
    onSuccess: props.onClose,
    onSettled: () =>
      client.invalidateQueries({ queryKey: ["conversion", props.projectId] }),
  });
  const valueValid =
    !value.trim() || (Number.isFinite(Number(value)) && Number(value) >= 0);
  return (
    <Sheet open onOpenChange={(open) => !open && props.onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>The conversion</SheetTitle>
          <SheetDescription>
            Choose the GA4 key event that means a new customer or lead, for
            example sign_up or generate_lead.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 text-sm">
          {gate.keyEvents.length === 0 ? (
            <p className="text-muted-foreground">
              GA4 has no key events yet. Mark one in GA4: Admin &gt; Events.
            </p>
          ) : (
            <select
              aria-label="Key event"
              className="h-9 w-full rounded-md border bg-background px-2"
              value={eventName}
              onChange={(event) => setEventName(event.target.value)}
            >
              {gate.keyEvents.map((event) => (
                <option key={event.eventName} value={event.eventName}>
                  {event.eventName} ({event.count} in 28 days)
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Traffic"
            className="h-9 w-full rounded-md border bg-background px-2"
            value={channel}
            onChange={(event) =>
              setChannel(
                event.target.value === "all" ? "all" : "organic_search",
              )
            }
          >
            <option value="organic_search">Organic search traffic only</option>
            <option value="all">All traffic</option>
          </select>
          <label className="block space-y-1">
            <span>Value of one conversion in {gate.currency} (optional)</span>
            <Input
              inputMode="decimal"
              placeholder="50"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          {save.error && (
            <p className="text-destructive">{save.error.message}</p>
          )}
        </div>
        <SheetFooter>
          <Button
            pending={save.isPending}
            disabled={!eventName || !valueValid}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
