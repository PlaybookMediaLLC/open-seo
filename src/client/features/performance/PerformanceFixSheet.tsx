import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import { useRefreshPublishing } from "@/client/features/publishing/queries";
import { preparePerformanceFix } from "@/serverFunctions/performance";
import { FIELD_DATA_LIMITS } from "@/shared/performance";
import type { PerformanceFixInput } from "@/types/schemas/performance";

type Fix = PerformanceFixInput["fix"];
const FIXES: Array<{
  fix: Fix;
  causes: string[];
  label: string;
  text: string;
}> = [
  {
    fix: "lcp_priority",
    causes: ["lcp_lazy_image", "lcp_not_prioritized"],
    label: "Load the LCP image first",
    text: 'Removes loading="lazy" and adds the priority prop of your Next.js version to the next/image element.',
  },
  {
    fix: "image_size",
    causes: ["unsized_images"],
    label: "Add the image size",
    text: "Adds width and height to an <img> element, read from the image file in public/.",
  },
  {
    fix: "script_strategy",
    causes: ["third_party_scripts"],
    label: "Load analytics or chat scripts later",
    text: 'Sets strategy="lazyOnload" on a next/script element for a reviewed analytics, chat or tag manager host.',
  },
];

/** RFC-0014 5.5: a performance fix in code, prepared for review. */
export function PerformanceFixSheet(props: {
  opportunity: { id: string; projectId: string; version: number };
  causeIds: string;
}) {
  const causes = new Set(props.causeIds.split(" "));
  const fixes = FIXES.filter((item) =>
    item.causes.some((cause) => causes.has(cause)),
  );
  const refresh = useRefreshPublishing(props.opportunity.projectId);
  const [open, setOpen] = useState(false);
  const [fix, setFix] = useState<Fix | undefined>(fixes[0]?.fix);
  const prepare = useMutation({
    meta: { errorToast: false },
    mutationFn: (chosen: Fix) =>
      preparePerformanceFix({
        data: {
          projectId: props.opportunity.projectId,
          opportunityId: props.opportunity.id,
          expectedOpportunityVersion: props.opportunity.version,
          fix: chosen,
        },
      }),
    onSuccess: (result) => {
      void refresh();
      if (!result.ok) return;
      toast.success(result.message);
      setOpen(false);
    },
  });
  if (!fixes.length) return null;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Fix in code
      </Button>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Fix the cause in code</SheetTitle>
          <SheetDescription>
            Relay finds the one element in your repository and prepares a pull
            request for review. {FIELD_DATA_LIMITS}
          </SheetDescription>
        </SheetHeader>
        <fieldset className="space-y-3 px-4 text-sm">
          <legend className="sr-only">Fix</legend>
          {fixes.map((item) => (
            <label key={item.fix} className="flex items-start gap-2">
              <input
                type="radio"
                name="performance-fix"
                className="mt-1"
                checked={fix === item.fix}
                onChange={() => setFix(item.fix)}
              />
              <span>
                <span className="font-medium">{item.label}</span>
                <span className="block text-muted-foreground">{item.text}</span>
              </span>
            </label>
          ))}
          {prepare.data && !prepare.data.ok && (
            <p role="alert" className="text-destructive">
              {prepare.data.message}
            </p>
          )}
        </fieldset>
        <SheetFooter>
          <Button
            pending={prepare.isPending}
            disabled={!fix}
            onClick={() => fix && prepare.mutate(fix)}
          >
            Prepare fix
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
