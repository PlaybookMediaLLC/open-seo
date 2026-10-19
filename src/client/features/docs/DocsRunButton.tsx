import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import { opportunityKeys } from "@/client/features/opportunities/shared";
import { findDocsOpportunities } from "@/serverFunctions/docs";

/** RFC-0017 5.3: one free run of the three docs checks. */
export function DocsRunButton({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const run = useMutation({
    mutationFn: () => findDocsOpportunities({ data: { projectId } }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({
        queryKey: opportunityKeys.all(projectId),
      });
      if (result.outcome === "completed") toast.success(result.message);
      else toast.error(result.message);
    },
  });
  return (
    <Button
      variant="outline"
      pending={run.isPending}
      onClick={() => run.mutate()}
    >
      Find docs gaps
    </Button>
  );
}
