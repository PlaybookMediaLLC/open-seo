import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Markdown } from "@/client/components/Markdown";
import { Button } from "@/client/components/ui/button";
import { Label } from "@/client/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import { Textarea } from "@/client/components/ui/textarea";
import { useRefreshPublishing } from "@/client/features/publishing/queries";
import {
  draftDocsText,
  getDocsPages,
  prepareDocsEdit,
} from "@/serverFunctions/docs";
import type { MarkdownEdit } from "@/types/schemas/docs";

const KINDS = {
  insert_section: "Insert a section after a heading",
  add_faq_item: "Add an item to the list under a heading",
  replace_paragraph: "Replace one paragraph",
} as const;
type Kind = keyof typeof KINDS;
const isKind = (value: string): value is Kind => value in KINDS;
const SELECT = "h-9 w-full rounded-md border bg-background px-2";

/** RFC-0017 5.5: one Markdown edit in a docs file, prepared for review. */
export function DocsEditSheet({
  opportunity,
}: {
  opportunity: { id: string; projectId: string; version: number };
}) {
  const { projectId } = opportunity;
  const refresh = useRefreshPublishing(projectId);
  const [open, setOpen] = useState(false);
  const [filePath, setFilePath] = useState("");
  const [kind, setKind] = useState<Kind>("insert_section");
  const [heading, setHeading] = useState("");
  const [before, setBefore] = useState("");
  const [text, setText] = useState("");
  const [facts, setFacts] = useState("");
  const [draftId, setDraftId] = useState<string>();
  const pages = useQuery({
    queryKey: ["docs-pages", projectId],
    queryFn: () => getDocsPages({ data: { projectId } }),
    enabled: open,
  });
  const page = pages.data?.find((item) => item.filePath === filePath);
  const edit: MarkdownEdit =
    kind === "replace_paragraph"
      ? { kind, before, after: text }
      : kind === "add_faq_item"
        ? { kind, heading, item: text }
        : { kind, heading, markdown: text };
  const scope = {
    projectId,
    opportunityId: opportunity.id,
    expectedOpportunityVersion: opportunity.version,
    filePath,
  };
  const draft = useMutation({
    meta: { errorToast: false },
    mutationFn: () =>
      draftDocsText({
        data: {
          ...scope,
          kind,
          target: kind === "replace_paragraph" ? before : heading,
          facts,
        },
      }),
    onSuccess: (result) => {
      if (!result.valueAfter) return;
      setText(result.valueAfter);
      setDraftId(result.id);
    },
  });
  // RFC-0017 5.6: a placeholder blocks the change until the owner fills it.
  const placeholders = (text.match(/\[Owner:[^\]]*\]/gi) ?? []).length;
  const prepare = useMutation({
    meta: { errorToast: false },
    mutationFn: () =>
      prepareDocsEdit({
        data: { ...scope, edit, draftId },
      }),
    onSuccess: (result) => {
      void refresh();
      if (!result.ok) return;
      toast.success(result.message);
      setOpen(false);
    },
  });
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Edit the docs
      </Button>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit the docs</SheetTitle>
          <SheetDescription>
            Relay changes one Markdown block and keeps front matter and JSX
            unchanged. Write only facts from your docs, changelog or product.
            Nothing is written until you approve the pull request.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 text-sm">
          {pages.isPending && <p role="status">Loading the docs index…</p>}
          {pages.data?.length === 0 && (
            <p>The docs index is empty. Index the docs first.</p>
          )}
          {pages.data && pages.data.length > 0 && (
            <>
              <Label htmlFor="docs-file">Docs file</Label>
              <select
                id="docs-file"
                className={SELECT}
                value={filePath}
                onChange={(event) => {
                  setFilePath(event.target.value);
                  setHeading("");
                }}
              >
                <option value="">Choose a file</option>
                {pages.data.map((item) => (
                  <option key={item.filePath} value={item.filePath}>
                    {item.title ?? item.urlPath} ({item.filePath})
                  </option>
                ))}
              </select>
              <Label htmlFor="docs-kind">Change</Label>
              <select
                id="docs-kind"
                className={SELECT}
                value={kind}
                onChange={(event) => {
                  if (isKind(event.target.value)) setKind(event.target.value);
                }}
              >
                {Object.entries(KINDS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {kind === "replace_paragraph" ? (
                <>
                  <Label htmlFor="docs-before">Current paragraph</Label>
                  <Textarea
                    id="docs-before"
                    rows={4}
                    placeholder="Paste the paragraph exactly as it is now."
                    value={before}
                    onChange={(event) => setBefore(event.target.value)}
                  />
                </>
              ) : (
                <>
                  <Label htmlFor="docs-heading">Heading</Label>
                  <select
                    id="docs-heading"
                    className={SELECT}
                    value={heading}
                    disabled={!page}
                    onChange={(event) => setHeading(event.target.value)}
                  >
                    <option value="">Choose a heading</option>
                    {page?.headings.map((item, index) => (
                      <option key={`${index}-${item.text}`} value={item.text}>
                        {"#".repeat(item.level)} {item.text}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <Label htmlFor="docs-facts">Facts for a draft (optional)</Label>
              <Textarea
                id="docs-facts"
                rows={3}
                placeholder="Commands, options and answers that the docs do not have yet."
                value={facts}
                onChange={(event) => setFacts(event.target.value)}
              />
              <Button
                variant="outline"
                pending={draft.isPending}
                disabled={
                  !filePath ||
                  (kind === "replace_paragraph" ? !before.trim() : !heading)
                }
                onClick={() => draft.mutate()}
              >
                Draft with AI (uses credits)
              </Button>
              {draft.data && (
                <p role="status" className="text-muted-foreground">
                  {draft.data.rationale} {draft.data.validationSummary}
                </p>
              )}
              {draft.isError && (
                <p role="alert" className="text-destructive">
                  {draft.error.message}
                </p>
              )}
              <Label htmlFor="docs-text">
                {kind === "insert_section"
                  ? "New section, starting with a heading at the same level"
                  : kind === "add_faq_item"
                    ? "New list item"
                    : "New paragraph"}
              </Label>
              <Textarea
                id="docs-text"
                rows={8}
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
              {placeholders > 0 && (
                <p role="alert" className="text-destructive">
                  Fill {placeholders} [Owner: …] placeholder
                  {placeholders === 1 ? "" : "s"} before you prepare the change.
                </p>
              )}
              {text.trim() && (
                <section aria-label="Preview" className="rounded-lg border p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Preview
                  </p>
                  <Markdown className="space-y-2">{text}</Markdown>
                </section>
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
            disabled={
              !filePath ||
              !text.trim() ||
              placeholders > 0 ||
              (kind === "replace_paragraph" ? !before.trim() : !heading)
            }
            onClick={() => prepare.mutate()}
          >
            Prepare the change
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
