import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import { opportunityKeys } from "@/client/features/opportunities/shared";
import { findConversionOpportunities } from "@/serverFunctions/conversion";

/** RFC-0012 5.3: one free GA4 run of the four conversion checks. */
export function ConversionRunButton({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const run = useMutation({
    mutationFn: () => findConversionOpportunities({ data: { projectId } }),
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
      Find conversion problems
    </Button>
  );
}
