import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import { listPageTexts, locateCopyText } from "@/serverFunctions/copyText";

type Scope = { projectId: string; opportunityId: string };
type Located = Awaited<ReturnType<typeof locateCopyText>>;

/** RFC-0012 5.4: pick a text on the live page and find it in the repository. */
export function CopyTextSheet(scope: Scope) {
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
