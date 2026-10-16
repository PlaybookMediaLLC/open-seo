import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { githubAppInstallations } from "@/db/schema";

type GithubAppInstallation = typeof githubAppInstallations.$inferSelect;

// Upserts the installation that the setup callback verified for this
// organization. A repeat install clears an earlier revocation.
export async function saveInstallation(
  installation: Omit<GithubAppInstallation, "id" | "revokedAt">,
) {
  await db
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
    });
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

export async function revokeInstallation(id: string) {
  await db
    .update(githubAppInstallations)
    .set({ revokedAt: new Date().toISOString() })
    .where(
      and(
        eq(githubAppInstallations.id, id),
        isNull(githubAppInstallations.revokedAt),
      ),
    );
}
