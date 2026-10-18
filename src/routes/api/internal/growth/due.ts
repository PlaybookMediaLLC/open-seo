import { createFileRoute } from "@tanstack/react-router";
import { GrowthJobService } from "@/server/features/growth/GrowthJobService";
import {
  jsonNoStore,
  notFound,
  readSignedBody,
} from "@/server/features/growth/internalAuth";

// RFC-0008 5.4: the due growth work, for the Trigger.dev dispatch task.
export const Route = createFileRoute("/api/internal/growth/due")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if ((await readSignedBody(request)) === null) return notFound();
        return jsonNoStore(await GrowthJobService.due(new Date()));
      },
    },
  },
});
