import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { ciTokens, projects } from "@/db/schema";
import { sha256Hex } from "@/server/lib/audit/ids";

// RFC-0010 5.9 and 6: project-scoped CI tokens. Only the hash is stored;
// the token is shown once.
const PREFIX = "relay_ci_";

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const encoded = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  return `${PREFIX}${encoded}`;
}

export async function createCiToken(input: {
  projectId: string;
  name: string;
  createdBy: string;
}) {
  const token = newToken();
  const row = {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    name: input.name,
    tokenHash: await sha256Hex(token),
    displayPrefix: token.slice(0, PREFIX.length + 4),
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };
  await db.insert(ciTokens).values(row);
  return { id: row.id, token, displayPrefix: row.displayPrefix };
}

export async function revokeCiToken(projectId: string, tokenId: string) {
  await db
    .update(ciTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(
      and(
        eq(ciTokens.projectId, projectId),
        eq(ciTokens.id, tokenId),
        isNull(ciTokens.revokedAt),
      ),
    );
}

/** The project of an active token from an `Authorization: Bearer` header. */
export async function verifyCiToken(authorization: string | null) {
  const token = authorization?.match(/^Bearer\s+(relay_ci_[\w-]{20,})$/)?.[1];
  if (!token) return null;
  const [row] = await db
    .select({
      tokenId: ciTokens.id,
      projectId: projects.id,
      organizationId: projects.organizationId,
      domain: projects.domain,
    })
    .from(ciTokens)
    .innerJoin(projects, eq(projects.id, ciTokens.projectId))
    .where(
      and(
        eq(ciTokens.tokenHash, await sha256Hex(token)),
        isNull(ciTokens.revokedAt),
        isNull(projects.archivedAt),
      ),
    );
  if (!row) return null;
  await db
    .update(ciTokens)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(ciTokens.id, row.tokenId));
  return row;
}

export type CiTokenContext = NonNullable<
  Awaited<ReturnType<typeof verifyCiToken>>
>;
