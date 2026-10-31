import { createFileRoute } from "@tanstack/react-router";
import { handleVerifyEmailLink } from "@/server/auth/verifyEmailLink";

// Playbook fork: /verify-email posts the token of a verification link here
// (src/server/auth/verifyEmailLink.ts).
export const Route = createFileRoute("/api/verify-email-link")({
  server: {
    handlers: {
      POST: ({ request }) => handleVerifyEmailLink(request),
    },
  },
});
