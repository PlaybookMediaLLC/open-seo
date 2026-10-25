import { useState } from "react";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { prepareMetadataProposal } from "@/serverFunctions/publishing";
import { prepareProposalInputSchema } from "@/types/schemas/publishing";
import { IndexingFields, type IndexingValues } from "./IndexingFields";
import { ProposalDrafts, useProposalFilePath } from "./ProposalDrafts";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/client/components/ui/button";
import type { Opportunity } from "@/types/schemas/opportunities";
import { useRefreshPublishing } from "./queries";

export function PrepareMetadataForm({
  opportunity,
  rootDirectory,
}: {
  opportunity: Pick<
    Opportunity,
    "id" | "projectId" | "url" | "status" | "version" | "type"
  >;
  rootDirectory: string;
}) {
  const [filePath, setTypedPath, locateNote] = useProposalFilePath(
    opportunity,
    rootDirectory,
  );
  const [description, setDescription] = useState("");
  // ponytail: a proposal records one draft; the description's wins.
  const [draftIds, setDraftIds] = useState<{
    description?: string;
    title?: string;
  }>({});
  const [title, setTitle] = useState("");
  const [indexing, setIndexing] = useState<IndexingValues | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useRefreshPublishing(opportunity.projectId);
  const mutation = useMutation({
    meta: { errorToast: false },
    mutationFn: async () => {
      const input = prepareProposalInputSchema.safeParse({
        projectId: opportunity.projectId,
        opportunityId: opportunity.id,
        expectedOpportunityVersion: opportunity.version,
        filePath,
        ...(indexing
          ? {
              newCanonical: indexing.canonical.trim() || undefined,
              newRobots: indexing.changeRobots
                ? { index: indexing.index, follow: indexing.follow }
                : undefined,
              confirmPath: indexing.confirmPath,
            }
          : {
              newDescription: description.trim() || undefined,
              newTitle: title.trim() || undefined,
              draftId:
                (description.trim() && draftIds.description) ||
                (title.trim() && draftIds.title) ||
                undefined,
            }),
      });
      if (!input.success)
        throw new Error(
          "Enter an existing page path, and a title or a description without line breaks.",
        );
      return prepareMetadataProposal({ data: input.data });
    },
    onSuccess: (result) => {
      setMessage(result.message);
      if (result.ok) {
        setDescription("");
        setTitle("");
        setDraftIds({});
      }
    },
    onError: () =>
      setMessage(
        "Could not prepare the proposal. Check the existing static page path and description, then try again. Refresh if the opportunity changed.",
      ),
    onSettled: () => {
      void refresh();
    },
  });
  return (
    <form
      className="space-y-4 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        mutation.mutate();
      }}
    >
      <fieldset disabled={mutation.isPending} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="publishing-file-path">
            Existing page file (repository-relative)
          </Label>
          <Input
            id="publishing-file-path"
            value={filePath}
            onChange={(event) => setTypedPath(event.target.value)}
            required
            maxLength={300}
            placeholder={`${rootDirectory ? `${rootDirectory}/` : ""}app/example/page.tsx`}
          />
          <p className="text-xs text-muted-foreground">
            {locateNote === null
              ? "Relay found this file in the repository. You can change it."
              : `${locateNote} The URL-based suggestion is not verified. Confirm the actual file under app/ or src/app/ (page.tsx and similar), or under pages/ or src/pages/ for the Pages Router. Include the configured root directory prefix.`}
          </p>
        </div>
        {opportunity.type === "technical_blocker" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setIndexing(
                indexing
                  ? null
                  : {
                      canonical: "",
                      changeRobots: false,
                      index: true,
                      follow: true,
                      confirmPath: "",
                    },
              )
            }
          >
            {indexing
              ? "Change the title or description instead"
              : "Change the canonical URL or robots instead"}
          </Button>
        )}
        {indexing ? (
          <IndexingFields
            values={indexing}
            onChange={setIndexing}
            pagePath={new URL(opportunity.url).pathname}
          />
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="publishing-title">
                Your replacement title (optional)
              </Label>
              <Input
                id="publishing-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                placeholder="Write the page title without the site name"
              />
              <p className="text-xs text-muted-foreground">
                Relay adds your layout's title template, such as "%s | Site",
                and checks that the final title has 10 to 60 characters.
              </p>
            </div>
            <ProposalDrafts
              opportunity={opportunity}
              filePath={filePath}
              kind="meta_title"
              onUse={(draft) => {
                setTitle(draft.valueAfter);
                setDraftIds((ids) => ({ ...ids, title: draft.id }));
              }}
            />
            <div className="space-y-2">
              <Label htmlFor="publishing-description">
                Your replacement description (optional)
              </Label>
              <Textarea
                id="publishing-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={320}
                rows={3}
                placeholder="Write an accurate description supported by this page's content"
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/320 characters. Write your own factual
                description, or use a checked draft and edit it.
              </p>
            </div>
            <ProposalDrafts
              opportunity={opportunity}
              filePath={filePath}
              kind="meta_description"
              onUse={(draft) => {
                setDescription(draft.valueAfter);
                setDraftIds((ids) => ({ ...ids, description: draft.id }));
              }}
            />
          </>
        )}
        <p className="text-sm text-muted-foreground">
          Preparation reads the selected file and package.json from the
          connected repository and verifies that only the title and description
          literals change. It writes nothing remotely and does not run the
          repository build or CI.
        </p>
        <Button
          type="submit"
          disabled={
            !filePath.trim() ||
            (indexing
              ? (!indexing.canonical.trim() && !indexing.changeRobots) ||
                !indexing.confirmPath
              : !description.trim() && !title.trim())
          }
          pending={mutation.isPending}
        >
          Prepare verified proposal
        </Button>
      </fieldset>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </form>
  );
}
