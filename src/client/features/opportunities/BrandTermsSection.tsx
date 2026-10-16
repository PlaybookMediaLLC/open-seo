import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QueryState } from "@/client/components/QueryState";
import { FormActions } from "@/client/components/FormActions";
import { Input } from "@/client/components/ui/input";
import { EditableListSection } from "@/client/features/projects/project-context/EditableListSection";
import {
  getBrandTerms,
  updateBrandTerms,
} from "@/serverFunctions/opportunities";
import { BRAND_TERM_LIMIT } from "@/types/schemas/opportunities";

/** RFC-0002 brand terms, shown on the project context page. */
export function BrandTermsSection({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["brand-terms", projectId];
  const query = useQuery({
    queryKey,
    queryFn: () => getBrandTerms({ data: { projectId } }),
  });
  const save = useMutation({
    mutationFn: (terms: string[]) =>
      updateBrandTerms({ data: { projectId, terms } }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      toast.success("Brand terms updated");
    },
  });
  return (
    <QueryState query={query} errorFallback="Failed to load brand terms">
      {({ terms, source }) => (
        <EditableListSection
          title="Brand terms"
          hint={
            source === "domain"
              ? "Taken from your domain until you save your own. Opportunity detection leaves out searches that contain these words."
              : "Opportunity detection leaves out searches that contain these words."
          }
          addLabel="Add term"
          emptyTitle="No brand terms"
          emptyDescription="Add your brand and product names, so searches for them do not count as low click-through or competing pages."
          items={terms}
          getId={(term) => term}
          getLabel={(term) => term}
          pending={save.isPending}
          onRemove={(term) =>
            save.mutate(terms.filter((saved) => saved !== term))
          }
          renderItem={(term) => (
            <span className="truncate text-sm font-medium">{term}</span>
          )}
          renderForm={(term, close) => (
            <TermForm
              initial={term ?? ""}
              pending={save.isPending}
              full={!term && terms.length >= BRAND_TERM_LIMIT}
              onCancel={close}
              onSave={(value) =>
                save.mutate(
                  term
                    ? terms.map((saved) => (saved === term ? value : saved))
                    : [...terms, value],
                  { onSuccess: close },
                )
              }
            />
          )}
        />
      )}
    </QueryState>
  );
}

function TermForm({
  initial,
  pending,
  full,
  onCancel,
  onSave,
}: {
  initial: string;
  pending: boolean;
  full: boolean;
  onCancel: () => void;
  onSave: (term: string) => void;
}) {
  const [term, setTerm] = React.useState(initial);
  const valid = term.trim().length >= 2 && !full;
  return (
    <form
      className="space-y-2 bg-muted/40 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !pending) onSave(term);
      }}
    >
      <Input
        autoFocus
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="e.g. acme"
        maxLength={60}
        aria-label="Brand term"
      />
      {full ? (
        <p className="text-xs text-muted-foreground">
          A project can have at most {BRAND_TERM_LIMIT} brand terms.
        </p>
      ) : null}
      <FormActions
        pending={pending}
        disabled={!valid}
        onCancel={onCancel}
        size="xs"
      />
    </form>
  );
}
