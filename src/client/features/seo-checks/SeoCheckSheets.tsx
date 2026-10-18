import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import {
  changeSeoCheckIgnore,
  createCiTokenFn,
  setPreviewAccess,
} from "@/serverFunctions/seoChecks";

// RFC-0010 5.11: the SEO checks setup sheets.
function SetupSheet(props: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  return (
    <Sheet open onOpenChange={(open) => !open && props.onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{props.title}</SheetTitle>
          <SheetDescription>{props.description}</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 text-sm">{props.children}</div>
        {props.footer && <SheetFooter>{props.footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  );
}

function useSave(projectId: string, onDone: () => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: onDone,
    onSettled: () =>
      client.invalidateQueries({ queryKey: ["seo-checks", projectId] }),
  });
}

export function TokenSheet(props: { projectId: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const create = useSave(props.projectId, () => undefined);
  return (
    <SetupSheet
      title="New CI token"
      description="Relay shows the token once. Store it as the RELAY_CI_TOKEN secret."
      onClose={props.onClose}
      footer={
        !token && (
          <Button
            pending={create.isPending}
            disabled={!name.trim()}
            onClick={() =>
              create.mutate(async () => {
                const created = await createCiTokenFn({
                  data: { projectId: props.projectId, name },
                });
                setToken(created.token);
              })
            }
          >
            Create
          </Button>
        )
      }
    >
      {token ? (
        <code className="block break-all rounded-md bg-muted p-3">{token}</code>
      ) : (
        <Input
          aria-label="Token name"
          placeholder="GitHub Actions"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      )}
    </SetupSheet>
  );
}

export function AccessSheet(props: {
  projectId: string;
  hasAccess: boolean;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<"header" | "cf_access">("header");
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const save = useSave(props.projectId, props.onClose);
  const header = kind === "header";
  return (
    <SetupSheet
      title="Preview access"
      description="Relay encrypts the value and sends it only to the preview host."
      onClose={props.onClose}
      footer={
        <>
          {props.hasAccess && (
            <Button
              variant="ghost"
              onClick={() =>
                save.mutate(() =>
                  setPreviewAccess({
                    data: { projectId: props.projectId, access: null },
                  }),
                )
              }
            >
              Remove
            </Button>
          )}
          <Button
            pending={save.isPending}
            disabled={!first.trim() || !second.trim()}
            onClick={() =>
              save.mutate(() =>
                setPreviewAccess({
                  data: {
                    projectId: props.projectId,
                    access: header
                      ? { kind: "header", headerName: first, value: second }
                      : {
                          kind: "cf_access",
                          clientId: first,
                          clientSecret: second,
                        },
                  },
                }),
              )
            }
          >
            Save
          </Button>
        </>
      }
    >
      <select
        aria-label="Access method"
        className="h-9 w-full rounded-md border bg-background px-2"
        value={kind}
        onChange={(event) =>
          setKind(event.target.value === "cf_access" ? "cf_access" : "header")
        }
      >
        <option value="header">
          A header, such as x-vercel-protection-bypass
        </option>
        <option value="cf_access">A Cloudflare Access service token</option>
      </select>
      <Input
        aria-label={header ? "Header name" : "Client ID"}
        placeholder={header ? "x-vercel-protection-bypass" : "Client ID"}
        value={first}
        onChange={(event) => setFirst(event.target.value)}
      />
      <Input
        type="password"
        aria-label={header ? "Header value" : "Client secret"}
        placeholder={header ? "Value" : "Client secret"}
        value={second}
        onChange={(event) => setSecond(event.target.value)}
      />
    </SetupSheet>
  );
}

export function IgnoreSheet(props: { projectId: string; onClose: () => void }) {
  const [rule, setRule] = useState("");
  const [pathPattern, setPathPattern] = useState("");
  const save = useSave(props.projectId, props.onClose);
  return (
    <SetupSheet
      title="Ignore rule"
      description="Relay drops findings of this rule on matching paths. Use * as a wildcard."
      onClose={props.onClose}
      footer={
        <Button
          pending={save.isPending}
          disabled={!rule.trim() || !pathPattern.trim()}
          onClick={() =>
            save.mutate(() =>
              changeSeoCheckIgnore({
                data: {
                  projectId: props.projectId,
                  add: { rule, pathPattern },
                },
              }),
            )
          }
        >
          Save
        </Button>
      }
    >
      <Input
        aria-label="Rule"
        placeholder="title-changed"
        value={rule}
        onChange={(event) => setRule(event.target.value)}
      />
      <Input
        aria-label="Path pattern"
        placeholder="/blog/*"
        value={pathPattern}
        onChange={(event) => setPathPattern(event.target.value)}
      />
    </SetupSheet>
  );
}
