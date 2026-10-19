import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CopyButton } from "@/client/components/CopyButton";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import { Textarea } from "@/client/components/ui/textarea";
import { getAccessibilityStatementFacts } from "@/serverFunctions/accessibility";
import { accessibilityStatement } from "@/shared/accessibilityStatement";

/** RFC-0013 5.7: a statement draft from stored facts, for the owner. */
export function AccessibilityStatementSheet({
  projectId,
}: {
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState("");
  const [edited, setEdited] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["accessibility-statement", projectId],
    queryFn: () => getAccessibilityStatementFacts({ data: { projectId } }),
    enabled: open,
  });
  const text =
    edited ?? (query.data ? accessibilityStatement(query.data, contact) : "");
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Draft a statement
      </Button>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Accessibility statement draft</SheetTitle>
          <SheetDescription>
            Relay writes the draft from the last audit only. Edit it, then
            publish it on your site yourself.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 text-sm">
          {query.isPending && <p role="status">Loading the audit facts…</p>}
          {query.isError && (
            <p role="alert" className="text-destructive">
              Could not load the audit facts. Try again.
            </p>
          )}
          {query.data === null && (
            <p>
              Run a site audit first. The draft uses its accessibility checks.
            </p>
          )}
          {query.data && (
            <>
              <Label htmlFor="statement-contact">Contact address</Label>
              <Input
                id="statement-contact"
                placeholder="accessibility@example.com"
                value={contact}
                disabled={edited !== null}
                onChange={(event) => setContact(event.target.value)}
              />
              <Label htmlFor="statement-text">Statement</Label>
              <Textarea
                id="statement-text"
                rows={18}
                value={text}
                onChange={(event) => setEdited(event.target.value)}
              />
              <CopyButton
                value={text}
                size="sm"
                label="Copy the statement"
                successMessage="Statement copied."
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
