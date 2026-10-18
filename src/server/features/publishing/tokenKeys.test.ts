import { symmetricEncrypt } from "better-auth/crypto";
import { afterEach, expect, it, vi } from "vitest";
import { encryptToken, openToken } from "./tokenKeys";

// RFC-0009 5.7: versioned repository token keys.
const env = vi.hoisted(() => ({ values: {} as Record<string, string> }));
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: async (name: string) => env.values[name],
}));
afterEach(() => {
  env.values = {};
});

const authSecret = "a".repeat(48);
const keyOne = "b".repeat(48);
const keyTwo = "c".repeat(48);

it("opens a version 0 token with the old secret and re-encrypts it", async () => {
  env.values = {
    BETTER_AUTH_SECRET: authSecret,
    PUBLISHING_TOKEN_KEY: keyOne,
    PUBLISHING_TOKEN_KEY_VERSION: "1",
  };
  const legacy = await symmetricEncrypt({ key: authSecret, data: "ghp_x" });
  const opened = await openToken({
    encryptedToken: legacy,
    tokenKeyVersion: 0,
  });
  expect(opened.token).toBe("ghp_x");
  expect(opened.rewrapped?.tokenKeyVersion).toBe(1);
  const current = await openToken({
    encryptedToken: opened.rewrapped?.encryptedToken ?? "",
    tokenKeyVersion: 1,
  });
  expect(current).toEqual({ token: "ghp_x", rewrapped: null });

  // One rotation later, the previous key still opens version 1.
  env.values = {
    ...env.values,
    PUBLISHING_TOKEN_KEY: keyTwo,
    PUBLISHING_TOKEN_KEY_VERSION: "2",
    PUBLISHING_TOKEN_KEY_PREVIOUS: keyOne,
  };
  expect(
    (
      await openToken({
        encryptedToken: opened.rewrapped?.encryptedToken ?? "",
        tokenKeyVersion: 1,
      })
    ).rewrapped?.tokenKeyVersion,
  ).toBe(2);
});

it("fails closed with the reconnect message when the key is missing", async () => {
  env.values = {
    BETTER_AUTH_SECRET: authSecret,
    PUBLISHING_TOKEN_KEY: keyOne,
    PUBLISHING_TOKEN_KEY_VERSION: "1",
  };
  const sealed = await encryptToken("ghp_x");
  env.values = { BETTER_AUTH_SECRET: authSecret };
  await expect(openToken(sealed)).rejects.toMatchObject({
    code: "CONFLICT",
    message: "Reconnect the repository.",
  });
});
