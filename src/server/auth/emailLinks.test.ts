import { expect, it } from "vitest";
import { linkWithToken } from "./emailLinks";

const resetUrl = `https://relay.test/api/auth/reset-password/tok?callbackURL=${encodeURIComponent(
  "https://relay.test/reset-password?redirect=/p/1",
)}`;

it("puts the token in the fragment, which browsers never send", () => {
  const link = new URL(linkWithToken(resetUrl, "/reset-password", "tok"));
  expect(link.origin + link.pathname).toBe("https://relay.test/reset-password");
  expect(link.search).toBe("?redirect=%2Fp%2F1");
  expect(link.hash).toBe("#token=tok");
});

it("sends the token only to our own page, whatever the callbackURL", () => {
  const verifyUrl = `https://relay.test/api/auth/verify-email?token=tok&callbackURL=${encodeURIComponent(
    "https://evil.test/steal",
  )}`;
  expect(linkWithToken(verifyUrl, "/verify-email", "tok")).toBe(
    "https://relay.test/verify-email#token=tok",
  );
});
