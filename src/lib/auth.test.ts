import { expect, it, vi } from "vitest";
import { getAuth } from "@/lib/auth";

vi.mock("cloudflare:workers", () => ({
  env: {
    AUTH_MODE: "hosted",
    BETTER_AUTH_URL: "https://relay.test",
    BETTER_AUTH_SECRET: "x".repeat(32),
    GOOGLE_CLIENT_ID: "id",
    GOOGLE_CLIENT_SECRET: "secret",
  },
}));

// Playbook fork: login CSRF. A link that signs in lets any page sign a visitor
// into the sender's account. Upstream signs in after verification, so a merge
// can bring it back without a visible failure.
it("signs no one in from an email link", () => {
  const { options } = getAuth();
  expect(options.emailVerification?.autoSignInAfterVerification).toBe(false);
  // Better Auth's change-email links sign in whatever the flag says.
  expect(options.user).not.toHaveProperty("changeEmail");
});
