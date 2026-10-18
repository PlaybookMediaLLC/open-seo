import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import { AppError } from "@/server/lib/errors";
import { MIN_BETTER_AUTH_SECRET_LENGTH } from "@/shared/selfhost-checks";

// RFC-0009 5.7: repository tokens use a dedicated, versioned key. Version 0
// is BETTER_AUTH_SECRET; PUBLISHING_TOKEN_KEY with a version of 1 or more
// replaces it, and the previous key stays readable for one rotation.
const MIN_KEY_LENGTH = 32;
const RECONNECT = "Reconnect the repository.";

async function keyring() {
  const auth = (await getOptionalEnvValue("BETTER_AUTH_SECRET"))?.trim();
  const secret =
    auth && auth.length >= MIN_BETTER_AUTH_SECRET_LENGTH ? auth : null;
  const key = (await getOptionalEnvValue("PUBLISHING_TOKEN_KEY"))?.trim();
  const previous = (
    await getOptionalEnvValue("PUBLISHING_TOKEN_KEY_PREVIOUS")
  )?.trim();
  const version = Number(
    (await getOptionalEnvValue("PUBLISHING_TOKEN_KEY_VERSION")) ?? "",
  );
  const usable = (value: string | undefined): value is string =>
    Boolean(value && value.length >= MIN_KEY_LENGTH);
  const current =
    usable(key) && Number.isInteger(version) && version >= 1
      ? { version, key }
      : secret
        ? { version: 0, key: secret }
        : null;
  const keyFor = (wanted: number) =>
    wanted === current?.version
      ? current.key
      : wanted === 0
        ? secret
        : current && wanted === current.version - 1 && usable(previous)
          ? previous
          : null;
  return { current, keyFor };
}

export async function encryptToken(token: string) {
  const { current } = await keyring();
  if (!current) throw new AppError("AUTH_CONFIG_MISSING");
  return {
    encryptedToken: await symmetricEncrypt({ key: current.key, data: token }),
    tokenKeyVersion: current.version,
  };
}

/**
 * Opens a stored token with the key of its version. A token under an older
 * key comes back with its re-encryption under the current key. A missing
 * key fails closed.
 */
export async function openToken(connection: {
  encryptedToken: string;
  tokenKeyVersion: number;
}) {
  const { current, keyFor } = await keyring();
  // No key at all is a configuration problem; a missing old key is not.
  if (!current) throw new AppError("AUTH_CONFIG_MISSING");
  const key = keyFor(connection.tokenKeyVersion);
  if (!key) throw new AppError("CONFLICT", RECONNECT);
  let token: string;
  try {
    token = await symmetricDecrypt({ key, data: connection.encryptedToken });
  } catch {
    throw new AppError("CONFLICT", RECONNECT);
  }
  if (connection.tokenKeyVersion === current.version)
    return { token, rewrapped: null };
  return {
    token,
    rewrapped: {
      encryptedToken: await symmetricEncrypt({ key: current.key, data: token }),
      tokenKeyVersion: current.version,
    },
  };
}
