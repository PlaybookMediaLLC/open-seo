import { useState } from "react";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Progress } from "@/client/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import { AUTUMN_SEO_DATA_CREDITS_PER_USD } from "@/shared/billing";

// RFC-0009 5.5: shared parts of the spending limit cards.
export const credits = (value: number) => value.toLocaleString("en-US");
const dollars = (value: number) =>
  `$${(value / AUTUMN_SEO_DATA_CREDITS_PER_USD).toFixed(2)}`;

/** "120 of 1,000 credits ($1.00)" with a bar, or the spend alone. */
export function LimitUsage({
  committed,
  limit,
}: {
  committed: number;
  limit: number | null;
}) {
  if (limit === null)
    return (
      <p className="text-sm">
        {credits(committed)} credits committed this month. No limit.
      </p>
    );
  return (
    <div className="space-y-2">
      <p className="text-sm">
        {credits(committed)} of {credits(limit)} credits ({dollars(limit)})
        committed this month.
      </p>
      <Progress
        value={limit > 0 ? Math.min(100, (committed / limit) * 100) : 100}
        aria-label="Share of the monthly limit committed"
      />
    </div>
  );
}

export function LimitSheet({
  title,
  limit,
  pending,
  onSave,
  onClose,
}: {
  title: string;
  limit: number | null;
  pending: boolean;
  onSave: (limit: number | null) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(limit === null ? "" : String(limit));
  const parsed = value.trim() === "" ? null : Number(value);
  const valid = parsed === null || (Number.isInteger(parsed) && parsed >= 0);
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Paid actions stop when the committed credits reach the limit. Leave
            the field empty for no limit. 1,000 credits cost $1.
          </SheetDescription>
        </SheetHeader>
        <label className="block space-y-1 px-4 text-sm">
          <span>Monthly limit in credits</span>
          <Input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={value}
            aria-invalid={!valid}
            onChange={(event) => setValue(event.target.value)}
          />
          {parsed !== null && valid && (
            <span className="text-xs text-muted-foreground">
              About {dollars(parsed)} a month.
            </span>
          )}
        </label>
        <SheetFooter>
          <Button
            type="button"
            pending={pending}
            disabled={!valid || pending}
            onClick={() => onSave(parsed)}
          >
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
