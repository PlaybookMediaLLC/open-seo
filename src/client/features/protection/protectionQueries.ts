import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { getProtection } from "@/serverFunctions/protection";

export type Protection = Awaited<ReturnType<typeof getProtection>>;

export const protectionQueryKey = (projectId: string) => [
  "protection",
  projectId,
];

/** A protection change, then a refetch of the whole record. */
export function useProtectionMutation<TVariables, TResult>(
  projectId: string,
  mutationFn: (variables: TVariables) => Promise<TResult>,
  onSuccess?: (result: TResult) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    meta: {
      errorMessages: {
        CONFLICT: "Protection settings changed. Reload and try again.",
      },
    },
    onSuccess: (result) => {
      onSuccess?.(result);
      void queryClient.invalidateQueries({
        queryKey: protectionQueryKey(projectId),
      });
    },
  });
}
