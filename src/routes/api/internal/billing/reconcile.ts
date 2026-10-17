import { createFileRoute } from "@tanstack/react-router";
import { reconcileSpend } from "@/server/billing/spendReconcile";
import {
  jsonNoStore,
  notFound,
  readSignedBody,
} from "@/server/features/growth/internalAuth";

// RFC-0009 5.4: retries failed settlements; called by `spend-reconcile`.
export const Route = createFileRoute("/api/internal/billing/reconcile")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if ((await readSignedBody(request)) === null) return notFound();
        return jsonNoStore(await reconcileSpend());
      },
    },
  },
});
