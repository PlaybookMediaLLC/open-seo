import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { dateLabel } from "@/client/features/opportunities/shared";
import { SupportSource } from "./SupportSource";
import {
  getDocsSettings,
  indexDocsNow,
  saveDocsSettings,
} from "@/serverFunctions/docs";

/** RFC-0017 5.2: where the docs live, and the size of the docs index. */
export function DocsSettings({ projectId }: { projectId: string }) {
  const queryKey = ["docs-settings", projectId];
  const client = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: () => getDocsSettings({ data: { projectId } }),
  });
  const [open, setOpen] = useState(false);
  const [pathPrefix, setPathPrefix] = useState("");
  const [directory, setDirectory] = useState("");
  const refresh = () => client.invalidateQueries({ queryKey });
  const save = useMutation({
    meta: { errorToast: false },
    mutationFn: () =>
      saveDocsSettings({ data: { projectId, pathPrefix, directory } }),
    onSuccess: () => {
      setOpen(false);
      void refresh();
    },
  });
  const index = useMutation({
    meta: { errorToast: false },
    mutationFn: () => indexDocsNow({ data: { projectId } }),
    onSuccess: () => void refresh(),
  });
  const data = query.data;
  if (!data) return null;
  const { settings } = data;
  const edit = () => {
    setPathPrefix(settings?.pathPrefix ?? "/docs/");
    setDirectory(settings?.directory ?? "content/docs");
    setOpen(true);
  };
  return (
    <section className="space-y-2 border-t pt-4 text-sm" aria-label="Docs">
      <h3 className="font-medium">Docs</h3>
      {settings ? (
        <p>
          Docs at <code>{settings.pathPrefix}</code> from{" "}
          <code>{settings.directory}</code>. {data.pages} pages indexed
          {data.lastIndexedAt
            ? `, last on ${dateLabel(data.lastIndexedAt)}`
            : ""}
          .
        </p>
      ) : (
        <p className="text-muted-foreground">
          Set where your docs live. Relay reads their titles and headings to
          find questions that the docs do not answer.
        </p>
      )}
      {data.canManage && (
        <div className="flex flex-wrap gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <Button size="sm" variant="outline" onClick={edit}>
              {settings ? "Change docs paths" : "Set docs paths"}
            </Button>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Docs paths</SheetTitle>
                <SheetDescription>
                  Relay reads up to 500 Markdown and MDX files from the docs
                  directory on the base branch. It stores titles and headings,
                  not the text.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-3 px-4">
                <Label htmlFor="docs-prefix">Docs path on the site</Label>
                <Input
                  id="docs-prefix"
                  placeholder="/docs/"
                  value={pathPrefix}
                  onChange={(event) => setPathPrefix(event.target.value)}
                />
                <Label htmlFor="docs-directory">
                  Docs directory in the repository
                </Label>
                <Input
                  id="docs-directory"
                  placeholder="content/docs"
                  value={directory}
                  onChange={(event) => setDirectory(event.target.value)}
                />
                <Button
                  pending={save.isPending}
                  disabled={!pathPrefix.trim() || !directory.trim()}
                  onClick={() => save.mutate()}
                >
                  Save
                </Button>
                {save.isError && (
                  <p role="alert" className="text-destructive">
                    {save.error.message}
                  </p>
                )}
              </div>
            </SheetContent>
          </Sheet>
          {settings && (
            <Button
              size="sm"
              variant="outline"
              pending={index.isPending}
              onClick={() => index.mutate()}
            >
              Index now
            </Button>
          )}
        </div>
      )}
      {index.data && <p role="status">{index.data.summary}</p>}
      {settings && (
        <SupportSource projectId={projectId} canManage={data.canManage} />
      )}
      {index.isError && (
        <p role="alert" className="text-destructive">
          {index.error.message}
        </p>
      )}
    </section>
  );
}
