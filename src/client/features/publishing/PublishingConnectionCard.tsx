import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { IconBrandGithub as Github } from "@tabler/icons-react";
import { CardShell } from "@/client/components/CardShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { QueryError } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  connectPublishingRepository,
  disconnectPublishingRepository,
} from "@/serverFunctions/publishing";
import { connectPublishingInputSchema } from "@/types/schemas/publishing";
import { GithubAppConnect } from "./GithubAppConnect";
import { ProductionEnvironmentForm } from "./ProductionEnvironmentForm";
import { publishingConnectionOptions, useRefreshPublishing } from "./queries";

const repositoryFields = [
  ["owner", "Repository owner", "your-organization"],
  ["repository", "Repository name", "website"],
  ["baseBranch", "Base branch", "main"],
  ["rootDirectory", "Root directory (optional)", "apps/web"],
] as const;

export function PublishingConnectionCard({ projectId }: { projectId: string }) {
  const query = useQuery(publishingConnectionOptions(projectId));
  const refresh = useRefreshPublishing(projectId);
  const formRef = useRef<HTMLFormElement>(null);
  const [authorized, setAuthorized] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connection = query.data?.connection;
  // Credentials stay in the uncontrolled password field, never in query variables or storage.
  const connect = useMutation({
    gcTime: 0,
    meta: { errorToast: false },
    mutationFn: async () => {
      const form = new FormData(formRef.current!);
      const input = connectPublishingInputSchema.safeParse({
        projectId,
        owner: form.get("owner"),
        repository: form.get("repository"),
        baseBranch: form.get("baseBranch"),
        rootDirectory: form.get("rootDirectory"),
        token: form.get("token"),
        authorizeRepositoryAccess: authorized,
      });
      if (!input.success)
        throw new Error(
          "Check the repository fields, fine-grained token, and authorization.",
        );
      return connectPublishingRepository({ data: input.data });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        setError(
          "Could not connect. Check the token scope, repository, and branch, then try again.",
        );
        return;
      }
      formRef.current?.reset();
      setAuthorized(false);
      setEditing(false);
      setError(null);
    },
    onError: () =>
      setError(
        "Could not connect. Check the token scope, repository, and branch, then try again.",
      ),
    onSettled: () => {
      const tokenInput = formRef.current?.elements.namedItem("token");
      if (tokenInput instanceof HTMLInputElement) tokenInput.value = "";
      connect.reset();
      void refresh();
    },
  });
  const disconnect = useMutation({
    meta: { errorToast: false },
    mutationFn: () => disconnectPublishingRepository({ data: { projectId } }),
    onSuccess: (result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setConfirmDisconnect(false);
      setEditing(false);
      setAuthorized(false);
      setError(null);
    },
    onError: () => setError("Could not disconnect the repository. Try again."),
    onSettled: () => {
      setConfirmDisconnect(false);
      void refresh();
    },
  });
  const busy = connect.isPending || disconnect.isPending;
  const canManage = query.isSuccess && query.data.canManage && !query.isError;
  return (
    <CardShell
      title="GitHub publishing"
      icon={<Github className="size-5" />}
      action={
        <Badge
          variant={connection && !connection.revokedAt ? "success" : "outline"}
        >
          {connection && !connection.revokedAt ? "Connected" : "Not connected"}
        </Badge>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Prepare a verified metadata description change, review it, then
          explicitly approve a pull request. Connecting cannot publish.
        </p>
        {query.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading repository connection…
          </p>
        ) : query.isError ? (
          <QueryError
            fallback="Could not load publishing connection"
            onRetry={() => void query.refetch()}
          />
        ) : (
          <>
            {!query.data.configured && (
              <p
                role="alert"
                className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
              >
                Server setup required: configure BETTER_AUTH_SECRET with at
                least 32 characters before connecting a repository.
              </p>
            )}
            {connection && (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
                <p className="font-medium break-all">
                  {connection.owner}/{connection.repository}
                </p>
                <p className="break-all text-muted-foreground">
                  Base branch: {connection.baseBranch} · Root:{" "}
                  {connection.rootDirectory || "/"}
                  {connection.transport === "github_app"
                    ? " · via the GitHub App"
                    : " · via a personal token"}
                </p>
                {connection.revokedAt ? (
                  <p className="text-destructive">
                    This connection has been revoked.
                  </p>
                ) : canManage ? (
                  <ProductionEnvironmentForm
                    key={connection.productionEnvironment}
                    projectId={projectId}
                    current={connection.productionEnvironment}
                  />
                ) : (
                  <p className="text-muted-foreground">
                    GitHub production environment:{" "}
                    {connection.productionEnvironment}
                  </p>
                )}
              </div>
            )}
            {canManage && query.data.configured && (
              <GithubAppConnect projectId={projectId} />
            )}
            {!canManage ? (
              <p className="text-sm text-muted-foreground">
                Read-only access. A project administrator can manage this
                connection.
              </p>
            ) : (
              <>
                {connection && !editing ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={busy || !query.data.configured}
                      onClick={() => {
                        setEditing(true);
                        setError(null);
                      }}
                    >
                      Replace connection
                    </Button>
                    {!connection.revokedAt && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => setConfirmDisconnect(true)}
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>
                ) : (
                  query.data.configured && (
                    <form
                      ref={formRef}
                      className="space-y-4"
                      autoComplete="off"
                      onSubmit={(event) => {
                        event.preventDefault();
                        setError(null);
                        connect.mutate();
                      }}
                    >
                      {connection && (
                        <p className="rounded-lg border border-amber-500/30 p-3 text-sm">
                          Replacing the connection invalidates all unexecuted
                          proposals. Prepare new proposals after reconnecting.
                        </p>
                      )}
                      <TokenInstructions />
                      <fieldset disabled={busy} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          {repositoryFields.map(
                            ([name, label, placeholder]) => (
                              <div className="space-y-2" key={name}>
                                <Label htmlFor={`publishing-${name}`}>
                                  {label}
                                </Label>
                                <Input
                                  id={`publishing-${name}`}
                                  name={name}
                                  defaultValue={
                                    connection?.[name] ??
                                    (name === "baseBranch" ? "main" : "")
                                  }
                                  placeholder={placeholder}
                                  required={name !== "rootDirectory"}
                                  maxLength={
                                    name === "owner" || name === "repository"
                                      ? 100
                                      : 200
                                  }
                                />
                              </div>
                            ),
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="publishing-token">
                            Fine-grained token
                          </Label>
                          <Input
                            id="publishing-token"
                            name="token"
                            type="password"
                            autoComplete="new-password"
                            placeholder="github_pat_…"
                            required
                            pattern="github_pat_[A-Za-z0-9_]{20,245}"
                            maxLength={256}
                          />
                          <p className="text-xs text-muted-foreground">
                            Never displayed again or saved in browser storage.
                            Cleared after every connection attempt.
                          </p>
                        </div>
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="authorize-repository"
                            checked={authorized}
                            onCheckedChange={setAuthorized}
                          />
                          <Label
                            htmlFor="authorize-repository"
                            className="text-sm leading-relaxed"
                          >
                            I authorize access to this selected repository.
                            Connecting reads repository metadata and the base
                            commit SHA, but does not create a branch, commit, or
                            pull request.
                          </Label>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="submit"
                            disabled={!authorized}
                            pending={connect.isPending}
                          >
                            Connect repository
                          </Button>
                          {editing && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                formRef.current?.reset();
                                setAuthorized(false);
                                setEditing(false);
                              }}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </fieldset>
                    </form>
                  )
                )}
              </>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      {confirmDisconnect && (
        <ConfirmDialog
          title="Disconnect repository?"
          confirmLabel="Disconnect repository"
          destructive
          pending={disconnect.isPending}
          onClose={() => setConfirmDisconnect(false)}
          onConfirm={() => {
            if (canManage) disconnect.mutate();
          }}
        >
          This revokes the locally stored credential and invalidates unexecuted
          proposals. It does not revoke the token on GitHub or close existing
          pull requests.
        </ConfirmDialog>
      )}
    </CardShell>
  );
}

function TokenInstructions() {
  return (
    <div className="rounded-lg bg-muted/40 p-4 text-sm space-y-2">
      <p className="font-medium">
        Use a minimally scoped fine-grained personal access token
      </p>
      <p>
        Select <strong>Only select repositories</strong> and select this
        repository only. Grant <strong>Contents: Read and write</strong> and{" "}
        <strong>Pull requests: Read and write</strong>. Do not grant Workflows
        permissions.
      </p>
      <p>
        To see deployment and check status, also grant{" "}
        <strong>Deployments: Read</strong>, <strong>Checks: Read</strong> and{" "}
        <strong>Commit statuses: Read</strong>. These are read-only. To create
        GitHub issues from approved tickets, grant{" "}
        <strong>Issues: Read and write</strong>.
      </p>
      <p className="text-muted-foreground">
        Choose a short expiry, such as 30 days, and rotate when needed. When the
        server has the GitHub App set up, connect through the App above instead.
      </p>
    </div>
  );
}
