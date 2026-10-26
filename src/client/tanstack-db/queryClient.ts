import { MutationCache, QueryClient } from "@tanstack/query-core";
import { toast } from "sonner";
import {
  getErrorCode,
  getStandardErrorMessage,
} from "@/client/lib/error-messages";
import type { ErrorCode } from "@/shared/error-codes";

declare module "@tanstack/query-core" {
  interface Register {
    mutationMeta: {
      // Set when the component shows the error itself (inline or in a catch).
      errorToast?: false;
      // Copy for codes this action can explain better than the standard
      // message, such as what a CONFLICT means for this form.
      errorMessages?: Partial<Record<ErrorCode, string>>;
    };
  }
}

// Only these can succeed on a second try. A validation error, a missing
// record or a setup gap fails the same way again, so retrying only delays the
// message. A null code is a network failure or an unexpected throw.
const RETRYABLE_CODES = new Set<ErrorCode | null>([
  null,
  "INTERNAL_ERROR",
  "UPSTREAM_UNAVAILABLE",
  "RATE_LIMITED",
]);

export const queryClient = new QueryClient({
  // Every failed mutation shows a toast unless it has its own onError or opts
  // out through meta, so no failure is silent.
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError || mutation.meta?.errorToast === false) {
        return;
      }
      const code = getErrorCode(error);
      toast.error(
        (code && mutation.meta?.errorMessages?.[code]) ??
          getStandardErrorMessage(error),
      );
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        failureCount < 3 && RETRYABLE_CODES.has(getErrorCode(error)),
      gcTime: 1000 * 60 * 60,
      staleTime: 1000 * 60 * 5, // 5 minutes — show cached data instantly, refetch in background after
    },
  },
});
