import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { captureClientEvent } from "@/client/lib/posthog";
import { getSignInSearch } from "@/lib/auth-redirect";

// Playbook fork: password reset and verification emails carry their token in
// the URL fragment (src/server/auth/emailLinks.ts). Browsers never send the
// fragment, so no request URL, log or trace holds the token. PostHog drops
// the fragment too (src/client/lib/posthog-sanitize.ts). The fragment stays in
// the address bar, so a reload keeps the link working.

/** The `#token=` of the current page. */
export function useLinkToken() {
  const [token] = useState(() =>
    new URLSearchParams(window.location.hash.slice(1)).get("token"),
  );
  return token;
}

const errorSchema = z.object({ code: z.string() });

/** Returns null on success, or Better Auth's error code in lower case. */
async function postVerificationToken(token: string) {
  const response = await fetch("/api/verify-email-link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (response.ok) return null;
  const body: unknown = await response.json().catch(() => null);
  return errorSchema.safeParse(body).data?.code.toLowerCase() ?? "unknown";
}

/** Verifies the email of a verification link. The link does not sign in
 *  (src/lib/auth.ts), so success opens sign-in; failure sets `?error=`, as
 *  Better Auth's own link did. True while the request runs. */
export function useVerifyEmailLink(redirectTo: string) {
  const token = useLinkToken();
  const navigate = useNavigate({ from: "/verify-email" });
  const [isPending, setIsPending] = useState(Boolean(token));
  useEffect(() => {
    if (!token) return;
    void postVerificationToken(token)
      .catch(() => "unknown")
      .then(async (error) => {
        if (!error) {
          captureClientEvent("auth:verification_success", {
            redirect_to: redirectTo,
          });
          toast.success("Email confirmed.");
          await navigate({
            to: "/sign-in",
            search: getSignInSearch(redirectTo),
            replace: true,
          });
          return;
        }
        setIsPending(false);
        // navigate() drops the fragment, so the token leaves the address bar.
        await navigate({
          search: (previous) => ({ ...previous, error }),
          replace: true,
        });
      });
  }, [token, navigate, redirectTo]);
  return isPending;
}
