import { createFileRoute } from "@tanstack/react-router";
import { serveLandingMedia } from "@/server/lib/landingMedia";

// Handler only: the landing page's video and poster, with byte ranges for
// Safari. See src/server/lib/landingMedia.ts.
export const Route = createFileRoute("/media/$name")({
  server: {
    handlers: {
      GET: ({ params, request }) => serveLandingMedia(params.name, request),
    },
  },
});
