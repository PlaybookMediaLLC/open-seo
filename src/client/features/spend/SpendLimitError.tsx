import { Link } from "@tanstack/react-router";
import { ErrorState } from "@/client/components/ErrorState";
import { Button } from "@/client/components/ui/button";
import { BILLING_ROUTE } from "@/shared/billing";
import { SPEND_LIMIT_MESSAGE } from "@/shared/spendLimits";

/** RFC-0009 5.5: a refused paid action, with the way to the limit. */
export function SpendLimitError({
  variant,
  title,
}: {
  variant?: "inline" | "card" | "page";
  title?: string;
}) {
  return (
    <ErrorState
      variant={variant}
      title={title}
      message={SPEND_LIMIT_MESSAGE}
      action={
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link to={BILLING_ROUTE} />}
        >
          Go to Billing
        </Button>
      }
    />
  );
}
