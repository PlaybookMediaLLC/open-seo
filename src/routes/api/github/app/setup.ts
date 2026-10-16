import { createFileRoute } from "@tanstack/react-router";
import { GithubAppService } from "@/server/features/publishing/GithubAppService";

// The GitHub App's user authorization callback (RFC-0005 5.7).
export const Route = createFileRoute("/api/github/app/setup")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) =>
        GithubAppService.handleSetup(request),
    },
  },
});
