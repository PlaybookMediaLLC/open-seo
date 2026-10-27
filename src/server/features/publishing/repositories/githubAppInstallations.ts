import { and, eq, exists, isNull } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  githubAppInstallationRepositories,
  githubAppInstallations,
} from "@/db/schema";
import {
  auditInsert,
  type AuditInput,
} from "@/server/features/activity/auditLog";

type GithubAppInstallation = typeof githubAppInstallations.$inferSelect;

// D1 binds at most 100 parameters; each repository row binds two.
const REPOSITORY_ROWS_PER_INSERT = 40;

// Upserts the installation that the setup callback verified for this
// organization, and replaces the repositories the linking user can reach.
// A repeat install clears an earlier revocation.
export async function saveInstallation(
  installation: Omit<GithubAppInstallation, "id" | "revokedAt">,
  repositoryIds: readonly string[],
  audit?: AuditInput,
): Promise<void> {
  const [existing] = await db
    .select({ id: githubAppInstallations.id })
    .from(githubAppInstallations)
    .where(
      and(
        eq(githubAppInstallations.organizationId, installation.organizationId),
        eq(githubAppInstallations.installationId, installation.installationId),
      ),
    );
  // Two first links racing pick different ids; the loser's repository rows
  // then fail the foreign key and its whole batch rolls back.
  const id = existing?.id ?? crypto.randomUUID();
  // A page that shifts during pagination can repeat a repository.
  const rows = [...new Set(repositoryIds)].map((repositoryId) => ({
    installationRef: id,
    repositoryId,
  }));
  await runBatch((tx) => [
    tx
      .insert(githubAppInstallations)
      .values({ ...installation, id, revokedAt: null })
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
    tx
      .delete(githubAppInstallationRepositories)
      .where(eq(githubAppInstallationRepositories.installationRef, id)),
    ...Array.from(
      { length: Math.ceil(rows.length / REPOSITORY_ROWS_PER_INSERT) },
      (_, chunk) =>
        tx
          .insert(githubAppInstallationRepositories)
          .values(
            rows.slice(
              chunk * REPOSITORY_ROWS_PER_INSERT,
              (chunk + 1) * REPOSITORY_ROWS_PER_INSERT,
            ),
          ),
    ),
    ...(audit ? [auditInsert(tx, audit)] : []),
  ]);
}

/** The repositories that the person who linked the installation could reach. */
export async function listInstallationRepositoryIds(
  installationRef: string,
): Promise<string[]> {
  const rows = await db
    .select({ repositoryId: githubAppInstallationRepositories.repositoryId })
    .from(githubAppInstallationRepositories)
    .where(
      eq(githubAppInstallationRepositories.installationRef, installationRef),
    );
  return rows.map((row) => row.repositoryId);
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
