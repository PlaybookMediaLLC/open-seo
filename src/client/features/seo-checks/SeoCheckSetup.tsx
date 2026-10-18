import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CardShell } from "@/client/components/CardShell";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Switch } from "@/client/components/ui/switch";
import {
  addPreviewHost,
  changeSeoCheckIgnore,
  removePreviewHost,
  revokeCiTokenFn,
  saveSeoCheckSettings,
  type getSeoChecks,
} from "@/serverFunctions/seoChecks";
import { AccessSheet, IgnoreSheet, TokenSheet } from "./SeoCheckSheets";

type Data = Awaited<ReturnType<typeof getSeoChecks>>;
const SNIPPET = `- uses: PlaybookMediaLLC/relay-seo-check@v1
  with:
    token: \${{ secrets.RELAY_CI_TOKEN }}
    preview-url: \${{ steps.deploy.outputs.url }}
    fail-on: blocking # blocking | warning | never`;

/** RFC-0010 5.11: tokens, preview hosts, protected access and rules. */
export function SeoCheckSetup({
  projectId,
  data,
}: {
  projectId: string;
  data: Data;
}) {
  const client = useQueryClient();
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["seo-checks", projectId] });
  const act = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSettled: refresh,
  });
  const [sheet, setSheet] = useState<"token" | "access" | "ignore" | null>(
    null,
  );
  const [host, setHost] = useState("");
  const { canManage } = data;
  const data_ = { projectId };
  return (
    <>
      <CardShell
        title="GitHub Action"
        action={
          canManage ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSheet("token")}
            >
              Create token
            </Button>
          ) : undefined
        }
      >
        <p className="mb-2 text-sm text-muted-foreground">
          Add this step after the step that deploys your preview, and store the
          token as the repository secret RELAY_CI_TOKEN.
        </p>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
          {SNIPPET}
        </pre>
        <ul className="mt-3 divide-y text-sm">
          {data.tokens.map((token) => (
            <li
              key={token.id}
              className="flex flex-wrap items-center gap-3 py-2"
            >
              <span className="font-medium">{token.name}</span>
              <code className="text-xs">{token.displayPrefix}…</code>
              <span className="text-xs text-muted-foreground">
                {token.revokedAt
                  ? "Revoked"
                  : token.lastUsedAt
                    ? `Last used ${new Date(token.lastUsedAt).toLocaleDateString()}`
                    : "Never used"}
              </span>
              {canManage && !token.revokedAt && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() =>
                    act.mutate(() =>
                      revokeCiTokenFn({
                        data: { ...data_, tokenId: token.id },
                      }),
                    )
                  }
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardShell>

      <CardShell title="Preview hosts">
        <p className="mb-2 text-sm text-muted-foreground">
          Relay checks previews on {data.domain ?? "your domain"} and its
          subdomains, and on Vercel, Netlify, Cloudflare Pages and Workers
          hosts. Add any other host here.
        </p>
        <ul className="divide-y text-sm">
          {data.hosts.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-1.5">
              <code>{row.host}</code>
              {canManage && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() =>
                    act.mutate(() =>
                      removePreviewHost({ data: { ...data_, hostId: row.id } }),
                    )
                  }
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
        {canManage && (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              act.mutate(() => addPreviewHost({ data: { ...data_, host } }));
              setHost("");
            }}
          >
            <Input
              aria-label="Preview host"
              placeholder="preview.example.dev or *.example.dev"
              value={host}
              onChange={(event) => setHost(event.target.value)}
            />
            <Button type="submit" size="sm" disabled={!host.trim()}>
              Add
            </Button>
          </form>
        )}
      </CardShell>

      <CardShell
        title="Protected previews and rules"
        action={
          canManage ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSheet("access")}
              >
                Preview access
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSheet("ignore")}
              >
                Add ignore rule
              </Button>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-3 text-sm">
          <p>
            {data.access
              ? data.access.kind === "cf_access"
                ? "Relay sends a Cloudflare Access service token to the preview host."
                : `Relay sends the ${data.access.headerName} header to the preview host.`
              : "No preview access is set. Relay checks public previews only."}
          </p>
          {data.ignores.map((ignore) => (
            <p key={ignore.id} className="flex items-center gap-3">
              <span>
                Ignore <code>{ignore.rule}</code> on{" "}
                <code>{ignore.pathPattern}</code>
              </span>
              {canManage && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    act.mutate(() =>
                      changeSeoCheckIgnore({
                        data: { ...data_, removeId: ignore.id },
                      }),
                    )
                  }
                >
                  Remove
                </Button>
              )}
            </p>
          ))}
          {[
            {
              key: "raiseOnHighTraffic" as const,
              label:
                "Block link and content drops on pages with 1,000 or more impressions",
            },
            {
              key: "checkPreviewRobotsHeader" as const,
              label: "Check the preview's X-Robots-Tag header",
            },
            {
              key: "renderedMode" as const,
              label:
                "Render up to 5 client-rendered pages in a browser. Uses rendering credits.",
            },
          ].map((option) => (
            <label key={option.key} className="flex items-center gap-3">
              <Switch
                checked={data[option.key]}
                disabled={!canManage || act.isPending}
                onCheckedChange={(checked) =>
                  act.mutate(() =>
                    saveSeoCheckSettings({
                      data: {
                        ...data_,
                        raiseOnHighTraffic: data.raiseOnHighTraffic,
                        checkPreviewRobotsHeader: data.checkPreviewRobotsHeader,
                        renderedMode: data.renderedMode,
                        [option.key]: checked,
                      },
                    }),
                  )
                }
              />
              {option.label}
            </label>
          ))}
        </div>
      </CardShell>

      {sheet === "token" && (
        <TokenSheet projectId={projectId} onClose={() => setSheet(null)} />
      )}
      {sheet === "access" && (
        <AccessSheet
          projectId={projectId}
          hasAccess={Boolean(data.access)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "ignore" && (
        <IgnoreSheet projectId={projectId} onClose={() => setSheet(null)} />
      )}
    </>
  );
}
