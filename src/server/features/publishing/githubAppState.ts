import { and, eq, gt, like, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { verification } from "@/db/schema";

// Single-use state for the GitHub App install flow, the same pattern as the
// Google data grant: a random nonce whose payload is deleted on first use.
const STATE_TTL_MS = 10 * 60 * 1_000;
const PREFIX = "github-app:";
const stateSchema = z.object({
  userId: z.string().min(1),
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
});

export async function createAppState(payload: z.infer<typeof stateSchema>) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const state = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  const now = new Date();
  await db
    .delete(verification)
    .where(
      and(
        like(verification.identifier, `${PREFIX}%`),
        lt(verification.expiresAt, now),
      ),
    );
  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier: `${PREFIX}${state}`,
    value: JSON.stringify(payload),
    expiresAt: new Date(now.getTime() + STATE_TTL_MS),
  });
  return state;
}

export async function consumeAppState(state: string | null) {
  if (!state) return null;
  const [row] = await db
    .delete(verification)
    .where(
      and(
        eq(verification.identifier, `${PREFIX}${state}`),
        gt(verification.expiresAt, new Date()),
      ),
    )
    .returning({ value: verification.value });
  if (!row) return null;
  try {
    return stateSchema.parse(JSON.parse(row.value));
  } catch {
    return null;
  }
}
