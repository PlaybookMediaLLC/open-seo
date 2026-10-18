import { and, eq, exists, isNull } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { githubAppInstallations } from "@/db/schema";
import {
  auditInsert,
  type AuditInput,
} from "@/server/features/activity/auditLog";

type GithubAppInstallation = typeof githubAppInstallations.$inferSelect;

// Upserts the installation that the setup callback verified for this
// organization. A repeat install clears an earlier revocation.
export async function saveInstallation(
  installation: Omit<GithubAppInstallation, "id" | "revokedAt">,
  audit?: AuditInput,
) {
  await runBatch((tx) => [
    tx
      .insert(githubAppInstallations)
      .values({ ...installation, id: crypto.randomUUID(), revokedAt: null })
      .onConflictDoUpdate({
        target: [
          githubAppInstallations.organizationId,
          githubAppInstallations.installationId,
        ],
        set: {
          accountLogin: installation.accountLogin,
          accountType: installation.accountType,
          revokedAt: null,
        },
      }),
    ...(audit ? [auditInsert(tx, audit)] : []),
  ]);
}

export function listInstallations(organizationId: string) {
  return db
    .select()
    .from(githubAppInstallations)
    .where(
      and(
        eq(githubAppInstallations.organizationId, organizationId),
        isNull(githubAppInstallations.revokedAt),
      ),
    );
}

export async function getInstallation(id: string) {
  const [row] = await db
    .select()
    .from(githubAppInstallations)
    .where(eq(githubAppInstallations.id, id));
  return row ?? null;
}

/**
 * The event lands only with the first revocation, never a repeat: it is
 * written first, while the row is still unrevoked. ponytail: on Postgres,
 * two concurrent revocations can both write it; D1 runs batches one at a
 * time.
 */
export async function revokeInstallation(id: string, audit?: AuditInput) {
  const unrevoked = and(
    eq(githubAppInstallations.id, id),
    isNull(githubAppInstallations.revokedAt),
  );
  await runBatch((tx) => [
    ...(audit
      ? [
          auditInsert(
            tx,
            audit,
            exists(
              tx
                .select({ id: githubAppInstallations.id })
                .from(githubAppInstallations)
                .where(unrevoked),
            ),
          ),
        ]
      : []),
    tx
      .update(githubAppInstallations)
      .set({ revokedAt: new Date().toISOString() })
      .where(unrevoked),
  ]);
}
