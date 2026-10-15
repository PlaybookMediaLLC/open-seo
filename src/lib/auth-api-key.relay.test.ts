import { describe, expect, it } from "vitest";
import { isApiKeyCredential } from "./auth-api-key";

describe("isApiKeyCredential", () => {
  it("routes Relay keys and pre-rename keys to API-key auth", () => {
    expect(isApiKeyCredential("relay_abc")).toBe(true);
    expect(isApiKeyCredential("oseo_abc")).toBe(true);
  });

  it("leaves OAuth tokens and missing headers to the OAuth provider", () => {
    expect(isApiKeyCredential("eyJhbGciOi.oauth.token")).toBe(false);
    expect(isApiKeyCredential(null)).toBe(false);
  });
});
