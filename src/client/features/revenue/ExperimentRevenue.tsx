import { formatMinor } from "@/shared/money";
import type { ExperimentRevenue as Revenue } from "@/types/schemas/revenue";

/** RFC-0016 5.7: revenue from first touches on the changed page. */
export function ExperimentRevenue({ revenue }: { revenue: Revenue | null }) {
  if (!revenue) return null;
  const windows = revenue.enough
    ? ([
        ["Baseline", revenue.baseline],
        ["Observation", revenue.observation],
      ] as const)
    : [];
  return (
    <section
      className="rounded-xl border bg-card p-4 space-y-2 text-sm"
      aria-label="Revenue from this page"
    >
      <h2 className="font-medium">Revenue from first touches on this page</h2>
      {revenue.enough ? (
        <table className="w-full text-left">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 pr-4 font-medium">Window</th>
              <th className="py-1 pr-4 font-medium">New customers</th>
              <th className="py-1 font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {windows.map(([label, window]) => (
              <tr key={label} className="border-t">
                <td className="py-1 pr-4">{label}</td>
                <td className="py-1 pr-4">{window.newCustomers}</td>
                <td className="py-1">
                  {window.revenue
                    .map((row) => formatMinor(row.revenueMinor, row.currency))
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted-foreground">
          Relay shows revenue when each window has at least {revenue.minimum}{" "}
          new customers whose first touch is this page.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Payments can come weeks after the first visit, so the observation window
        may not show the full effect. Relay counts each payment on its payment
        date.
      </p>
    </section>
  );
}
