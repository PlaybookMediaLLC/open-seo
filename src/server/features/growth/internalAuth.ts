import { getOptionalEnvValue } from "@/server/lib/runtime-env";

// RFC-0008 5.4: the internal endpoints accept only a fresh HMAC-SHA256
// signature of `{timestamp}.{rawBody}`. Any failure looks like a missing page.
const MAX_BODY_BYTES = 64 * 1024;
const MAX_SKEW_SECONDS = 300;
const encoder = new TextEncoder();

/**
 * "trigger" when Trigger.dev is configured (a signing secret and its key, or
 * GROWTH_JOBS_MODE=trigger with a secret); "off" when GROWTH_JOBS_MODE=off;
 * otherwise "cron": the Worker's own cron runs the jobs (cronScheduler.ts).
 */
export async function growthJobsMode(): Promise<"trigger" | "cron" | "off"> {
  const mode = await getOptionalEnvValue("GROWTH_JOBS_MODE");
  if (mode === "off") return "off";
  if (!(await getOptionalEnvValue("GROWTH_JOBS_SECRET"))) return "cron";
  if (mode) return mode === "trigger" ? "trigger" : "cron";
  return (await getOptionalEnvValue("TRIGGER_SECRET_KEY")) ? "trigger" : "cron";
}

function hexBytes(hex: string) {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) =>
    Number.parseInt(pair, 16),
  );
}

async function signatureMatches(secret: string, data: string, hex: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  // verify() compares in constant time.
  return crypto.subtle.verify("HMAC", key, hexBytes(hex), encoder.encode(data));
}

/** The parsed JSON body of a valid signed request, or null. */
export async function readSignedBody(request: Request): Promise<unknown> {
  // Only Trigger.dev calls the signed endpoints; cron runs in the Worker.
  if (request.method !== "POST" || (await growthJobsMode()) !== "trigger")
    return null;
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES)
    return null;
  const timestamp = request.headers.get("x-relay-timestamp") ?? "";
  const signature = request.headers.get("x-relay-signature") ?? "";
  if (!/^\d{1,12}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature))
    return null;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS)
    return null;
  const raw = await request.text();
  if (encoder.encode(raw).byteLength > MAX_BODY_BYTES) return null;
  // Two secrets for one deploy allow a rotation without failed jobs.
  const secrets = [
    await getOptionalEnvValue("GROWTH_JOBS_SECRET"),
    await getOptionalEnvValue("GROWTH_JOBS_SECRET_PREVIOUS"),
  ].filter((secret): secret is string => Boolean(secret));
  for (const secret of secrets)
    if (await signatureMatches(secret, `${timestamp}.${raw}`, signature)) {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    }
  return null;
}

/** The same answer for every refusal, never cached. */
export function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "cache-control": "no-store" },
  });
}

export function jsonNoStore(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
