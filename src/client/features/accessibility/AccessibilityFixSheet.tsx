import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRefreshPublishing } from "@/client/features/publishing/queries";
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
import { prepareAccessibilityFix } from "@/serverFunctions/accessibility";
import { ACCESSIBILITY_LIMITS } from "@/shared/accessibility";

const LANG_RULES = new Set(["html-has-lang", "html-lang-valid"]);

/** RFC-0013 5.4: alt text or the page language, prepared for review. */
export function AccessibilityFixSheet(props: {
  opportunity: { id: string; projectId: string; version: number };
  ruleId: string;
}) {
  const lang = LANG_RULES.has(props.ruleId);
  const refresh = useRefreshPublishing(props.opportunity.projectId);
  const [open, setOpen] = useState(false);
  const [decorative, setDecorative] = useState(false);
  const [text, setText] = useState("");
  const prepare = useMutation({
    meta: { errorToast: false },
    mutationFn: () =>
      prepareAccessibilityFix({
        data: {
          projectId: props.opportunity.projectId,
          opportunityId: props.opportunity.id,
          expectedOpportunityVersion: props.opportunity.version,
          fix: lang
            ? { kind: "lang", language: text.trim() }
            : { kind: "alt", decorative, text },
        },
      }),
    onSuccess: (result) => {
      void refresh();
      if (!result.ok) return;
      toast.success(result.message);
      setOpen(false);
    },
  });
  if (!lang && props.ruleId !== "image-alt") return null;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Fix in code
      </Button>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {lang ? "Set the page language" : "Add alternative text"}
          </SheetTitle>
          <SheetDescription>
            Relay finds the one element in your repository and prepares a pull
            request for review. {ACCESSIBILITY_LIMITS}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 text-sm">
          {lang ? (
            <>
              <Label htmlFor="fix-language">Language tag of the pages</Label>
              <Input
                id="fix-language"
                placeholder="en"
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </>
          ) : (
            <>
              <select
                aria-label="Image purpose"
                className="h-9 w-full rounded-md border bg-background px-2"
                value={decorative ? "decorative" : "describe"}
                onChange={(event) =>
                  setDecorative(event.target.value === "decorative")
                }
              >
                <option value="describe">The image shows information</option>
                <option value="decorative">The image is only decoration</option>
              </select>
              {decorative ? (
                <p className="text-muted-foreground">
                  Relay sets alt=&quot;&quot;, so screen readers skip the image.
                </p>
              ) : (
                <>
                  <Label htmlFor="fix-alt">Alternative text</Label>
                  <Input
                    id="fix-alt"
                    maxLength={150}
                    placeholder="Team planning a release at a whiteboard"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                  />
                </>
              )}
            </>
          )}
          {prepare.data && !prepare.data.ok && (
            <p role="alert" className="text-destructive">
              {prepare.data.message}
            </p>
          )}
        </div>
        <SheetFooter>
          <Button
            pending={prepare.isPending}
            disabled={!decorative && !text.trim()}
            onClick={() => prepare.mutate()}
          >
            Prepare fix
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
