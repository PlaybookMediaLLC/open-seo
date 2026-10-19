import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dateLabel } from "@/client/features/opportunities/shared";
import { getRevenueReport } from "@/serverFunctions/revenue";

const CHANNELS: Record<string, string> = {
  organic_search: "Organic search",
  paid: "Paid",
  email: "Email",
  referral: "Referral",
  direct: "Direct",
  unknown: "Unknown",
};
const PERIODS = [30, 90, 365] as const;

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(minor / 100);

/** RFC-0016 5.6: revenue by first touch, with the coverage first. */
export function RevenueReport({ projectId }: { projectId: string }) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(90);
  const query = useQuery({
    queryKey: ["revenue-report", projectId, days],
    queryFn: () => getRevenueReport({ data: { projectId, days } }),
  });
  const report = query.data;
  if (!report) return null;
  const { newCustomers, attributed } = report.coverage;
  const share = newCustomers ? attributed / newCustomers : null;
  const table = (
    rows: Array<{
      label: string;
      revenueMinor: number;
      newCustomers: number;
      firstPaymentsMinor: number;
    }>,
    currency: string,
    heading: string,
  ) => (
    <table className="w-full text-left text-sm">
      <thead className="text-xs text-muted-foreground">
        <tr>
          <th className="py-1 pr-4 font-medium">{heading}</th>
          <th className="py-1 pr-4 font-medium">Revenue</th>
          <th className="py-1 pr-4 font-medium">New customers</th>
          <th className="py-1 font-medium">Average first payment</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-t">
            <td className="py-1 pr-4 break-all">{row.label}</td>
            <td className="py-1 pr-4">{money(row.revenueMinor, currency)}</td>
            <td className="py-1 pr-4">{row.newCustomers}</td>
            <td className="py-1">
              {row.newCustomers
                ? money(row.firstPaymentsMinor / row.newCustomers, currency)
                : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <section
      className="rounded-xl border bg-card p-4 space-y-3 text-sm"
      aria-label="Revenue by first touch"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">Revenue by first touch</h2>
        <select
          aria-label="Period"
          className="h-8 rounded-md border bg-background px-2"
          value={days}
          onChange={(event) =>
            setDays(
              PERIODS.find((period) => period === Number(event.target.value)) ??
                90,
            )
          }
        >
          {PERIODS.map((period) => (
            <option key={period} value={period}>
              Last {period} days
            </option>
          ))}
        </select>
      </div>
      {share !== null && share < 0.8 ? (
        <p role="alert" className="font-medium text-destructive">
          Only {Math.round(share * 100)}% of new customers have attribution
          data. Check the snippet.
        </p>
      ) : (
        <p className="text-muted-foreground">
          {share === null
            ? "No new customers in this period."
            : `${Math.round(share * 100)}% of new customers have attribution data.`}{" "}
          {report.lastSyncedAt
            ? `Synced ${dateLabel(report.lastSyncedAt)}.`
            : "Not synced yet."}
        </p>
      )}
      {report.currencies.map((group) => (
        <div key={group.currency} className="space-y-2">
          <h3 className="text-xs font-medium uppercase text-muted-foreground">
            {group.currency}
          </h3>
          <div className="overflow-x-auto">
            {table(
              group.byChannel.map((row) => ({
                ...row,
                label: CHANNELS[row.channel] ?? row.channel,
              })),
              group.currency,
              "Channel",
            )}
          </div>
          <div className="overflow-x-auto">
            {table(
              group.byPath.map((row) => ({
                ...row,
                label: row.path ?? "(no landing page)",
              })),
              group.currency,
              "First landing page",
            )}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Revenue is the payments minus refunds in the period, by the
        customer&apos;s first landing page and channel. Amounts are not
        converted between currencies.
      </p>
    </section>
  );
}
