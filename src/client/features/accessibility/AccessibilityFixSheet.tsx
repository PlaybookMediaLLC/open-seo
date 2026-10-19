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
import {
  draftAltText,
  prepareAccessibilityFix,
  suggestAccessibleName,
} from "@/serverFunctions/accessibility";
import { ACCESSIBILITY_LIMITS } from "@/shared/accessibility";

const LANG_RULES = new Set(["html-has-lang", "html-lang-valid"]);
const NAME_RULES = new Set(["link-name", "button-name", "label"]);
const TITLES = {
  lang: "Set the page language",
  alt: "Add alternative text",
  name: "Add an accessible name",
} as const;

/** RFC-0013 5.4: alt text, the page language or a name, for review. */
export function AccessibilityFixSheet(props: {
  opportunity: { id: string; projectId: string; version: number };
  ruleId: string;
}) {
  const mode = LANG_RULES.has(props.ruleId)
    ? "lang"
    : props.ruleId === "image-alt"
      ? "alt"
      : NAME_RULES.has(props.ruleId)
        ? "name"
        : null;
  const refresh = useRefreshPublishing(props.opportunity.projectId);
  const [open, setOpen] = useState(false);
  const [decorative, setDecorative] = useState(false);
  const [text, setText] = useState("");
  const [draftId, setDraftId] = useState<string | undefined>();
  const scope = {
    projectId: props.opportunity.projectId,
    opportunityId: props.opportunity.id,
    expectedOpportunityVersion: props.opportunity.version,
  };
  // A checked draft fills the field; the person edits and approves it.
  const draft = useMutation({
    meta: { errorToast: false },
    mutationFn: () => draftAltText({ data: scope }),
    onSuccess: (result) => {
      if (result.status !== "generated") return;
      setText(result.valueAfter);
      setDraftId(result.id);
    },
  });
  const suggest = useMutation({
    meta: { errorToast: false },
    mutationFn: () => suggestAccessibleName({ data: scope }),
    onSuccess: (result) => {
      if (result.text) setText(result.text);
    },
  });
  const prepare = useMutation({
    meta: { errorToast: false },
    mutationFn: () =>
      prepareAccessibilityFix({
        data: {
          ...scope,
          fix:
            mode === "lang"
              ? { kind: "lang", language: text.trim() }
              : mode === "alt"
                ? { kind: "alt", decorative, text }
                : { kind: "name", text },
          draftId,
        },
      }),
    onSuccess: (result) => {
      void refresh();
      if (!result.ok) return;
      toast.success(result.message);
      setOpen(false);
    },
  });
  if (!mode) return null;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Fix in code
      </Button>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{TITLES[mode]}</SheetTitle>
          <SheetDescription>
            Relay finds the one element in your repository and prepares a pull
            request for review. {ACCESSIBILITY_LIMITS}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 text-sm">
          {mode === "name" ? (
            <>
              <Label htmlFor="fix-name">Accessible name</Label>
              <Input
                id="fix-name"
                maxLength={100}
                placeholder={
                  props.ruleId === "label" ? "Email address" : "View pricing"
                }
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
              {props.ruleId !== "button-name" && (
                <Button
                  size="sm"
                  variant="outline"
                  pending={suggest.isPending}
                  onClick={() => suggest.mutate()}
                >
                  Suggest a name
                </Button>
              )}
              {suggest.isError && (
                <p role="alert" className="text-destructive">
                  {suggest.error.message}
                </p>
              )}
              {suggest.data && (
                <p className="text-xs text-muted-foreground">
                  {suggest.data.source}
                </p>
              )}
              <p className="text-muted-foreground">
                Relay sets aria-label. Say what the element does, such as
                &quot;Open the menu&quot;.
              </p>
            </>
          ) : mode === "lang" ? (
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
                  <Button
                    size="sm"
                    variant="outline"
                    pending={draft.isPending}
                    onClick={() => draft.mutate()}
                  >
                    Draft with AI
                  </Button>
                  {draft.isError && (
                    <p role="alert" className="text-destructive">
                      {draft.error.message}
                    </p>
                  )}
                  {draft.data && (
                    <p className="text-xs text-muted-foreground">
                      {draft.data.status === "generated"
                        ? draft.data.validationSummary
                        : draft.data.rationale}
                    </p>
                  )}
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
