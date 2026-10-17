import { createFileRoute } from "@tanstack/react-router";
import { GrowthJobService } from "@/server/features/growth/GrowthJobService";
import {
  jsonNoStore,
  notFound,
  readSignedBody,
} from "@/server/features/growth/internalAuth";

// RFC-0008 5.3: deletes job runs, logs and notifications older than 180 days.
export const Route = createFileRoute("/api/internal/growth/retention")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if ((await readSignedBody(request)) === null) return notFound();
        return jsonNoStore(await GrowthJobService.retention());
      },
    },
  },
});
