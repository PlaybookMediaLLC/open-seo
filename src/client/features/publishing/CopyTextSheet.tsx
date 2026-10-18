import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import {
  listPageTexts,
  locateCopyText,
  prepareCopyProposal,
} from "@/serverFunctions/copyText";
import { useRefreshPublishing } from "./queries";

type Scope = { projectId: string; opportunityId: string };
type Found = Extract<
  Awaited<ReturnType<typeof locateCopyText>>,
  { status: "found" }
>;
type Located = Awaited<ReturnType<typeof locateCopyText>>;

/** RFC-0012 5.4: pick a text on the live page and find it in the repository. */
export function CopyTextSheet({
  opportunity,
}: {
  opportunity: { id: string; projectId: string; version: number };
}) {
  const scope = {
    projectId: opportunity.projectId,
    opportunityId: opportunity.id,
  };
  const expectedOpportunityVersion = opportunity.version;
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const texts = useQuery({
    queryKey: ["copy-text", scope.projectId, scope.opportunityId],
    queryFn: () => listPageTexts({ data: scope }),
    enabled: open,
    staleTime: 60_000,
  });
  const locate = useMutation({
    meta: { errorToast: false },
    mutationFn: (text: string) => locateCopyText({ data: { ...scope, text } }),
  });
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Change page text
      </Button>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Change page text</SheetTitle>
          <SheetDescription>
            Pick a heading, button, link, label or short paragraph from the live
            page. Relay finds the one place in the repository that holds it.
            Nothing is written.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6 text-sm">
          {texts.isPending && <p role="status">Reading the live page…</p>}
          {texts.isError && (
            <p role="alert" className="text-destructive">
              {texts.error.message}
            </p>
          )}
          {chosen ? (
            <div className="space-y-3">
              <p className="rounded-md bg-muted p-3">{chosen}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setChosen(null);
                  locate.reset();
                }}
              >
                Pick another text
              </Button>
              {locate.isPending && (
                <p role="status">Searching the repository…</p>
              )}
              {locate.isError && (
                <p role="alert" className="text-destructive">
                  {locate.error.message}
                </p>
              )}
              {locate.data && <LocateResult result={locate.data} />}
              {locate.data?.status === "found" && (
                <PrepareCopy
                  scope={scope}
                  expectedOpportunityVersion={expectedOpportunityVersion}
                  text={chosen}
                  found={locate.data}
                  onDone={() => setOpen(false)}
                />
              )}
            </div>
          ) : (
            <ul className="space-y-1">
              {texts.data?.texts.map((item) => (
                <li key={item.text}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 rounded-md p-2 text-left hover:bg-muted"
                    onClick={() => {
                      setChosen(item.text);
                      locate.mutate(item.text);
                    }}
                  >
                    <Badge variant="outline">{item.kind}</Badge>
                    <span>{item.text}</span>
                  </button>
                </li>
              ))}
              {texts.data?.texts.length === 0 && (
                <li className="text-muted-foreground">
                  The live page has no text Relay can pick.
                </li>
              )}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LocateResult({ result }: { result: Located }) {
  if (result.status !== "found")
    return (
      <div className="space-y-2">
        <p role="alert">{result.message}</p>
        {"matches" in result && result.matches.length > 0 && (
          <ul className="list-disc pl-5 font-mono text-xs">
            {result.matches.map((match) => (
              <li key={`${match.path}:${match.line}`}>
                {match.path}:{match.line}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  return (
    <div className="space-y-2">
      <p>
        Found in <code>{result.path}</code>, line {result.line}.
      </p>
      {result.sharedPages.length > 0 ? (
        <div>
          <p className="font-medium">
            These pages use the same text and change too:
          </p>
          <ul className="list-disc pl-5 font-mono text-xs">
            {result.sharedPages.map((page) => (
              <li key={page}>{page}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground">
          {result.sharingComplete
            ? "No other page imports this text."
            : "Relay checked the first 30 page files. Other pages may also use this text."}
        </p>
      )}
    </div>
  );
}

/** RFC-0012 5.4: the new text, and the confirmation for shared pages. */
function PrepareCopy(props: {
  scope: Scope;
  expectedOpportunityVersion: number;
  text: string;
  found: Found;
  onDone: () => void;
}) {
  const refresh = useRefreshPublishing(props.scope.projectId);
  const [newText, setNewText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const shared = props.found.sharedPages.length > 0;
  const prepare = useMutation({
    meta: { errorToast: false },
    mutationFn: () =>
      prepareCopyProposal({
        data: {
          ...props.scope,
          expectedOpportunityVersion: props.expectedOpportunityVersion,
          edits: [{ text: props.text, newText }],
          confirmSharedPages: confirmed,
        },
      }),
    onSuccess: (result) => {
      void refresh();
      if (!result.ok) return;
      toast.success(result.message);
      props.onDone();
    },
  });
  return (
    <div className="space-y-3 border-t pt-3">
      <Label htmlFor="copy-new-text">New text</Label>
      <Input
        id="copy-new-text"
        value={newText}
        maxLength={500}
        onChange={(event) => setNewText(event.target.value)}
      />
      {shared && (
        <Label className="flex items-start gap-2 font-normal">
          <Checkbox
            checked={confirmed}
            onCheckedChange={(checked) => setConfirmed(checked)}
          />
          The pages listed above change too.
        </Label>
      )}
      {prepare.data && !prepare.data.ok && (
        <p role="alert" className="text-destructive">
          {prepare.data.message}
        </p>
      )}
      <Button
        pending={prepare.isPending}
        disabled={
          !newText.trim() ||
          newText.trim() === props.text ||
          (shared && !confirmed)
        }
        onClick={() => prepare.mutate()}
      >
        Prepare change
      </Button>
      <p className="text-xs text-muted-foreground">
        Relay prepares a proposal for review. Nothing is written to GitHub until
        you approve it.
      </p>
    </div>
  );
}
