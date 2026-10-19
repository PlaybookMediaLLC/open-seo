import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { dateLabel } from "@/client/features/opportunities/shared";
import {
  connectStripe,
  disconnectStripe,
  getRevenueConnection,
} from "@/serverFunctions/revenue";

/** RFC-0016 5.3: a read-only Stripe key, for revenue by landing page. */
export function StripeConnection({ projectId }: { projectId: string }) {
  const queryKey = ["revenue-connection", projectId];
  const client = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: () => getRevenueConnection({ data: { projectId } }),
  });
  const [key, setKey] = useState("");
  const [confirming, setConfirming] = useState(false);
  const refresh = () => client.invalidateQueries({ queryKey });
  const connect = useMutation({
    meta: { errorToast: false },
    mutationFn: () => connectStripe({ data: { projectId, key } }),
    onSuccess: () => {
      setKey("");
      void refresh();
    },
  });
  const disconnect = useMutation({
    meta: { errorToast: false },
    mutationFn: () => disconnectStripe({ data: { projectId } }),
    onSuccess: () => {
      setConfirming(false);
      void refresh();
    },
  });
  const connection = query.data;
  return (
    <CardShell title="Revenue from Stripe">
      <p className="mb-3 text-sm text-muted-foreground">
        Relay reads paid invoices with a read-only key, and joins them to the
        first landing page of each customer. It stores no names, emails or
        addresses.
      </p>
      {connection ? (
        <div className="space-y-3 text-sm">
          <p>
            Connected in {connection.livemode ? "live" : "test"} mode on{" "}
            {dateLabel(connection.createdAt)}.{" "}
            {connection.lastSyncedAt
              ? `Last sync: ${dateLabel(connection.lastSyncedAt)}.`
              : "No sync yet."}
          </p>
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <p>Disconnecting deletes the key and all revenue data.</p>
              <Button
                variant="destructive"
                pending={disconnect.isPending}
                onClick={() => disconnect.mutate()}
              >
                Delete and disconnect
              </Button>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setConfirming(true)}>
              Disconnect
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            In Stripe, create a restricted key with read access to Invoices,
            Subscriptions, Checkout Sessions and Customers, and no write access.
            Relay refuses secret keys and keys that can write.
          </p>
          <Label htmlFor="stripe-key">Restricted key</Label>
          <Input
            id="stripe-key"
            type="password"
            autoComplete="off"
            placeholder="rk_live_..."
            value={key}
            onChange={(event) => setKey(event.target.value)}
          />
          <Button
            pending={connect.isPending}
            disabled={!key.trim()}
            onClick={() => connect.mutate()}
          >
            Connect Stripe
          </Button>
        </div>
      )}
      {(connect.isError || disconnect.isError) && (
        <p role="alert" className="text-sm text-destructive">
          {(connect.error ?? disconnect.error)?.message}
        </p>
      )}
    </CardShell>
  );
}
