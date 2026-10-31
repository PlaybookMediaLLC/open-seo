import { expect, it, vi } from "vitest";
import { handleVerifyEmailLink } from "./verifyEmailLink";

const verifyEmail = vi.hoisted(() => vi.fn());
vi.mock("cloudflare:workers", () => ({ env: { AUTH_MODE: "hosted" } }));
vi.mock("@/lib/auth", () => ({
  getAuth: () => ({ api: { verifyEmail } }),
  hasBetterAuthConfig: () => true,
}));

// The token must reach Better Auth from the body, because no request URL may
// carry it; Better Auth's answer carries its status and error code.
it("verifies the token from the request body and returns Better Auth's answer", async () => {
  const answer = new Response(null, { status: 200 });
  verifyEmail.mockResolvedValueOnce(answer);

  const response = await handleVerifyEmailLink(
    new Request("https://relay.test/api/verify-email-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "jwt" }),
    }),
  );

  expect(response).toBe(answer);
  expect(verifyEmail).toHaveBeenCalledWith(
    expect.objectContaining({ query: { token: "jwt" }, asResponse: true }),
  );
});
