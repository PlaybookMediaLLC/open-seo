import { env } from "cloudflare:workers";
import { z } from "zod";
import { getAuth, hasBetterAuthConfig } from "@/lib/auth";
import { usesBetterAuth } from "@/lib/auth-mode";

// Playbook fork: verification links carry their token in the URL fragment
// (src/server/auth/emailLinks.ts), and /verify-email posts it to
// /api/verify-email-link. Better Auth's own endpoint is a GET that reads the
// token from the query string, so it is called in-process and no request URL
// holds the token. Its answer passes through: 200 on success (the link does
// not sign in, see src/lib/auth.ts), `{ code }` on failure.
const bodySchema = z.object({ token: z.string().min(1).max(4096) });

export async function handleVerifyEmailLink(request: Request) {
  if (!usesBetterAuth(env.AUTH_MODE) || !hasBetterAuthConfig()) {
    return new Response("Not found", { status: 404 });
  }
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ code: "INVALID_TOKEN" }, { status: 400 });
  }
  return getAuth().api.verifyEmail({
    query: { token: body.data.token },
    headers: request.headers,
    asResponse: true,
  });
}
