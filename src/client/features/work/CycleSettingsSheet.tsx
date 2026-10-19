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
      toast.success("Cycle settings saved.");
      setOpen(false);
      void client.invalidateQueries({ queryKey: ["this-week", projectId] });
    },
  });
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Cycle settings
      </Button>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Cycle settings</SheetTitle>
          <SheetDescription>
            Next shows only items at or above the quality bar. There is no
            weekly quota. Saving turns the weekly cycle on.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 text-sm">
          <Label htmlFor="cycle-bar">Quality bar (20 to 80)</Label>
          <Input
            id="cycle-bar"
            type="number"
            min={20}
            max={80}
            value={values.qualityBar}
            onChange={(event) => set("qualityBar", event.target.value)}
          />
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
          <Label htmlFor="cycle-hour">Hour (0 to 23)</Label>
          <Input
            id="cycle-hour"
            type="number"
            min={0}
            max={23}
            value={values.cycleHour}
            onChange={(event) => set("cycleHour", event.target.value)}
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
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
