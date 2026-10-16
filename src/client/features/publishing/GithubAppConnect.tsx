import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  connectGithubApp,
  getGithubAppState,
  listGithubAppRepositories,
} from "@/serverFunctions/publishing";
import { useRefreshPublishing } from "./queries";

// The GitHub App connection: access limited to the chosen repositories and to
// short-lived tokens per operation (RFC-0005 5.7).
export function GithubAppConnect({ projectId }: { projectId: string }) {
  const refresh = useRefreshPublishing(projectId);
  const [load, setLoad] = useState(false);
  const [selected, setSelected] = useState("");
  const [baseBranch, setBaseBranch] = useState("");
  const [rootDirectory, setRootDirectory] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const state = useQuery({
    queryKey: ["publishing", projectId, "github-app"],
    queryFn: () => getGithubAppState({ data: { projectId } }),
  });
  const repositories = useQuery({
    queryKey: ["publishing", projectId, "github-app", "repositories"],
    queryFn: () => listGithubAppRepositories({ data: { projectId } }),
    enabled: load,
  });
  const repository = repositories.data?.find(
    (item) => `${item.installationRef}:${item.id}` === selected,
  );
  const connect = useMutation({
    meta: { errorToast: false },
    mutationFn: () => {
      if (!repository) throw new Error("Choose a repository.");
      return connectGithubApp({
        data: {
          projectId,
          installationRef: repository.installationRef,
          repositoryId: repository.id,
          baseBranch: baseBranch.trim() || repository.defaultBranch,
          rootDirectory: rootDirectory.trim(),
        },
      });
    },
    onSuccess: (result) => setMessage(result.message),
    onError: () => setMessage("Could not connect the repository."),
    onSettled: () => refresh(),
  });
  if (!state.data?.configured) return null;
  return (
    <div className="space-y-3 rounded-lg border p-4 text-sm">
      <p className="font-medium">GitHub App (recommended)</p>
      <p className="text-muted-foreground">
        Install the Relay GitHub App on the repositories you choose. Relay uses
        a short-lived token for each operation and stores no token.
      </p>
      {state.data.installUrl && (
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={state.data.installUrl} />}
        >
          Install GitHub App
        </Button>
      )}
      {state.data.installations.length > 0 &&
        (!load ? (
          <Button variant="outline" size="sm" onClick={() => setLoad(true)}>
            Choose a repository from the App
          </Button>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setMessage(null);
              connect.mutate();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="github-app-repository">Repository</Label>
              <select
                id="github-app-repository"
                className="w-full rounded-md border bg-background px-3 py-2"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
                required
              >
                <option value="">
                  {repositories.isPending ? "Loading…" : "Choose a repository"}
                </option>
                {repositories.data?.map((item) => (
                  <option
                    key={`${item.installationRef}:${item.id}`}
                    value={`${item.installationRef}:${item.id}`}
                  >
                    {item.owner}/{item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="github-app-branch">Base branch</Label>
              <Input
                id="github-app-branch"
                value={baseBranch}
                onChange={(event) => setBaseBranch(event.target.value)}
                placeholder={repository?.defaultBranch ?? "main"}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="github-app-root">Root directory (optional)</Label>
              <Input
                id="github-app-root"
                value={rootDirectory}
                onChange={(event) => setRootDirectory(event.target.value)}
                placeholder="apps/web"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={!repository}
              pending={connect.isPending}
            >
              Connect through the App
            </Button>
          </form>
        ))}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
