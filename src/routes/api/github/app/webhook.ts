import { createFileRoute } from "@tanstack/react-router";
import { jsonNoStore } from "@/server/features/growth/internalAuth";
import {
  handleDeploymentStatus,
  releaseDelivery,
  verifyWebhook,
} from "@/server/features/seo-checks/githubAppMode";

// RFC-0010 5.12: GitHub App webhooks. Only deployment_status starts work.
export const Route = createFileRoute("/api/github/app/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const verified = await verifyWebhook(request);
        if (!verified.ok)
          return jsonNoStore({ error: "unauthorized" }, verified.status);
        if (verified.duplicate || verified.event !== "deployment_status")
          return jsonNoStore({ result: "ignored" }, 202);
        try {
          const result = await handleDeploymentStatus(verified.payload);
          return jsonNoStore({ result }, 202);
        } catch (error) {
          await releaseDelivery(verified.delivery);
          throw error;
        }
      },
    },
  },
});
