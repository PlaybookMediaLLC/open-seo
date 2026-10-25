import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import { saveWorkSettings } from "@/serverFunctions/work";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const SELECT = "h-9 w-full rounded-md border bg-background px-2";
type Settings = {
  qualityBar: number;
  openPrLimit: number;
  cycleDay: number;
  cycleHour: number;
  timeZone: string;
};

/** RFC-0018 5.4 and 5.9: the quality bar, the pull request limit, the day. */
export function CycleSettingsSheet({
  projectId,
  settings,
}: {
  projectId: string;
  settings: Settings;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(settings);
  const set = (key: keyof Settings, value: string) =>
    setValues((current) => ({
      ...current,
      [key]: key === "timeZone" ? value : Number(value),
    }));
  const save = useMutation({
    meta: { errorToast: false },
    mutationFn: () => saveWorkSettings({ data: { projectId, ...values } }),
    onSuccess: () => {
      toast.success("Weekly review settings saved.");
      setOpen(false);
      void client.invalidateQueries({ queryKey: ["this-week", projectId] });
    },
  });
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        onClick={() => {
          setValues(settings);
          setOpen(true);
        }}
      >
        Weekly review settings
      </Button>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Weekly review settings</SheetTitle>
          <SheetDescription>
            Next shows only items at or above the quality bar. There is no
            weekly quota. Saving does not turn the weekly review on or off.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 text-sm">
          <Label htmlFor="cycle-quality">Work selection</Label>
          <select
            id="cycle-quality"
            className={SELECT}
            value={
              [20, 40, 60, 80].includes(values.qualityBar)
                ? values.qualityBar
                : "custom"
            }
            onChange={(event) => set("qualityBar", event.target.value)}
          >
            <option value={20}>Explore more eligible work</option>
            <option value={40}>Balanced priority</option>
            <option value={60}>High priority</option>
            <option value={80}>Highest priority only</option>
            <option value="custom" disabled>
              Custom priority score
            </option>
          </select>
          <details>
            <summary className="cursor-pointer text-sm">
              Advanced: priority threshold
            </summary>
            <p className="my-2 text-sm text-muted-foreground">
              This filters the priority score, not the probability of success.
              Freshness, confidence and connection checks still apply.
            </p>
            <Label htmlFor="cycle-bar">Minimum score (20 to 80)</Label>
            <Input
              id="cycle-bar"
              type="number"
              min={20}
              max={80}
              value={values.qualityBar}
              onChange={(event) => set("qualityBar", event.target.value)}
            />
          </details>
          <Label htmlFor="cycle-prs">Open Relay pull requests (1 to 10)</Label>
          <Input
            id="cycle-prs"
            type="number"
            min={1}
            max={10}
            value={values.openPrLimit}
            onChange={(event) => set("openPrLimit", event.target.value)}
          />
          <Label htmlFor="cycle-day">Day</Label>
          <select
            id="cycle-day"
            className={SELECT}
            value={values.cycleDay}
            onChange={(event) => set("cycleDay", event.target.value)}
          >
            {DAYS.map((day, index) => (
              <option key={day} value={index + 1}>
                {day}
              </option>
            ))}
          </select>
          <Label htmlFor="cycle-hour">Review time</Label>
          <Input
            id="cycle-hour"
            type="time"
            step={3600}
            value={`${String(values.cycleHour).padStart(2, "0")}:00`}
            onChange={(event) =>
              set("cycleHour", event.target.value.split(":")[0] ?? "0")
            }
          />
          <Label htmlFor="cycle-zone">Time zone</Label>
          <Input
            id="cycle-zone"
            placeholder="Europe/Berlin"
            value={values.timeZone}
            onChange={(event) => set("timeZone", event.target.value)}
          />
          {save.isError && (
            <p role="alert" className="text-destructive">
              {save.error.message}
            </p>
          )}
        </div>
        <SheetFooter>
          <Button pending={save.isPending} onClick={() => save.mutate()}>
            Save settings
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
