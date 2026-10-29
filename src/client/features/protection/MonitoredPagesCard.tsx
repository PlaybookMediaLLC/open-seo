import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CardShell } from "@/client/components/CardShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { QueryState } from "@/client/components/QueryState";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import {
  saveMonitoredPages,
  suggestMonitoredPages,
} from "@/serverFunctions/protection";
import { MAX_MONITORED_PAGES } from "@/shared/protection";
import {
  protectionQueryKey,
  useProtectionMutation,
  type Protection,
} from "./protectionQueries";

type Enrollment = NonNullable<Protection["enrollment"]>;
type Page = Protection["pages"][number];
type PageChange = Omit<
  Parameters<typeof saveMonitoredPages>[0]["data"],
  "projectId" | "expectedScopeVersion"
>;

const REASON_LABELS = {
  owner: "Chosen",
  key_page: "Key page",
  top_traffic: "Top traffic",
} as const satisfies Record<Page["selectionReason"], string>;

// RFC-0026 phase A: the agreed page set. Excluded pages stay listed but are
// never checked; every change is made against the scope version shown.
export function MonitoredPagesCard({
  projectId,
  data,
  enrollment,
}: {
  projectId: string;
  data: Protection;
  enrollment: Enrollment;
}) {
  const [path, setPath] = useState("");
  const [excluding, setExcluding] = useState<Page | null>(null);
  const [reason, setReason] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const suggestions = useQuery({
    queryKey: [
      ...protectionQueryKey(projectId),
      "suggestions",
      enrollment.scopeVersion,
    ],
    queryFn: () => suggestMonitoredPages({ data: { projectId } }),
    enabled: suggesting,
  });
  const save = useProtectionMutation(projectId, (change: PageChange) =>
    saveMonitoredPages({
      data: {
        projectId,
        expectedScopeVersion: enrollment.scopeVersion,
        ...change,
      },
    }),
  );
  const checked = data.pages.filter((page) => !page.excludedReason).length;
  const room = MAX_MONITORED_PAGES - checked;
  const canEdit = data.canManage && !save.isPending;
  return (
    <CardShell
      title="Pages"
      titleInfo={
        <span className="text-sm font-normal text-muted-foreground">
          {checked} of {MAX_MONITORED_PAGES} checked
        </span>
      }
    >
      <div className="space-y-4 text-sm">
        {data.pages.length ? (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Checked</TableHead>
                  {data.canManage ? (
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell className="font-mono">{page.path}</TableCell>
                    <TableCell>{REASON_LABELS[page.selectionReason]}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {page.excludedReason
                        ? `Excluded: ${page.excludedReason}`
                        : "Yes"}
                    </TableCell>
                    {data.canManage ? (
                      <TableCell className="space-x-2 text-right whitespace-nowrap">
                        {page.excludedReason ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canEdit || room <= 0}
                            onClick={() => save.mutate({ include: [page.id] })}
                          >
                            Include
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canEdit}
                            onClick={() => {
                              setReason("");
                              setExcluding(page);
                            }}
                          >
                            Exclude
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!canEdit}
                          onClick={() => save.mutate({ remove: [page.id] })}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        ) : (
          <p className="text-muted-foreground">
            No pages yet. Protect the pages that matter most, such as pricing,
            sign-up and your top landing pages.
          </p>
        )}
        {data.canManage ? (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!path.trim()) return;
              save.mutate(
                { add: [{ path: path.trim(), selectionReason: "owner" }] },
                { onSuccess: () => setPath("") },
              );
            }}
          >
            <Input
              aria-label="Page path"
              className="max-w-sm font-mono"
              placeholder="/pricing"
              value={path}
              onChange={(event) => setPath(event.target.value)}
            />
            <Button type="submit" size="sm" disabled={!canEdit || room <= 0}>
              Add page
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSuggesting((open) => !open)}
            >
              {suggesting ? "Hide suggestions" : "Add from suggestions"}
            </Button>
          </form>
        ) : null}
        {suggesting ? (
          <QueryState
            query={suggestions}
            errorFallback="Could not load suggestions"
          >
            {(rows) =>
              rows.length ? (
                <ul className="divide-y rounded-lg border">
                  {rows.map((row) => (
                    <li
                      key={row.path}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <span className="min-w-0 truncate font-mono">
                        {row.path}
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {REASON_LABELS[row.selectionReason]}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canEdit || room <= 0}
                          onClick={() => save.mutate({ add: [row] })}
                        >
                          Add
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">
                  No suggestions. Relay suggests the project's key pages and its
                  top Search Console pages on this origin.
                </p>
              )
            }
          </QueryState>
        ) : null}
        {excluding ? (
          <ConfirmDialog
            title={`Exclude ${excluding.path}?`}
            confirmLabel="Exclude"
            pending={save.isPending}
            onClose={() => setExcluding(null)}
            onConfirm={() => {
              if (!reason.trim()) {
                toast.error("Say why this page is excluded.");
                return;
              }
              save.mutate(
                { exclude: [{ pageId: excluding.id, reason: reason.trim() }] },
                { onSettled: () => setExcluding(null) },
              );
            }}
          >
            <span className="block">
              Relay keeps listing it but never checks it.
            </span>
            <Input
              aria-label="Why it is excluded"
              className="mt-3"
              maxLength={300}
              placeholder="Intentionally not indexed"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </ConfirmDialog>
        ) : null}
      </div>
    </CardShell>
  );
}
