import { createFileRoute } from "@tanstack/react-router";
import { GrowthJobService } from "@/server/features/growth/GrowthJobService";
import {
  jsonNoStore,
  notFound,
  readSignedBody,
} from "@/server/features/growth/internalAuth";
import { growthRunInputSchema } from "@/types/schemas/growthJobs";

// RFC-0008 5.4: runs one growth job. 503 asks Trigger.dev to retry; 422 is
// final.
export const Route = createFileRoute("/api/internal/growth/run")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = await readSignedBody(request);
        if (body === null) return notFound();
        const input = growthRunInputSchema.safeParse(body);
        if (!input.success) return jsonNoStore({ error: "Invalid body." }, 422);
        const result = await GrowthJobService.run(input.data);
        return jsonNoStore(result.body, result.status);
      },
    },
  },
});
