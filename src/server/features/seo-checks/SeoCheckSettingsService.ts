import { and, asc, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import {
  ciCheckFindings,
  ciCheckIgnores,
  ciCheckRuns,
  ciCheckUrls,
  ciPreviewAccess,
  ciPreviewHosts,
  ciProjectSettings,
  ciTokens,
} from "@/db/schema";
import { hasOrgPermission } from "@/lib/org-permissions";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { auditInsert } from "@/server/features/activity/auditLog";
import {
  authorize,
  type OpportunityContext,
} from "@/server/features/opportunities/services/opportunityAccess";
import { encryptToken } from "@/server/features/publishing/tokenKeys";
import { AppError } from "@/server/lib/errors";
import { normalizeCrawlerHost } from "@/shared/crawler-access";
import { createCiToken, revokeCiToken } from "./ciTokens";

// RFC-0010 5.11: Project settings > SEO checks. Members read; owners and
// admins (integration:manage) change tokens, hosts, access and rules.
const RUN_LIMIT = 20;
const canManage = (context: OpportunityContext) =>
  hasOrgPermission(context.role, { integration: ["manage"] });
const manage = async (context: OpportunityContext, projectId: string) => {
  await authorize(context, projectId);
  requireOrgPermission(context, { integration: ["manage"] });
};

async function get(context: OpportunityContext, projectId: string) {
  const project = await authorize(context, projectId);
  const [tokens, hosts, [access], ignores, [settings], runs] =
    await Promise.all([
      db
        .select({
          id: ciTokens.id,
          name: ciTokens.name,
          displayPrefix: ciTokens.displayPrefix,
          createdAt: ciTokens.createdAt,
          lastUsedAt: ciTokens.lastUsedAt,
          revokedAt: ciTokens.revokedAt,
        })
        .from(ciTokens)
        .where(eq(ciTokens.projectId, projectId))
        .orderBy(desc(ciTokens.createdAt)),
      db
        .select({ id: ciPreviewHosts.id, host: ciPreviewHosts.host })
        .from(ciPreviewHosts)
        .where(eq(ciPreviewHosts.projectId, projectId))
        .orderBy(asc(ciPreviewHosts.host)),
      db
        .select({
          kind: ciPreviewAccess.kind,
          headerName: ciPreviewAccess.headerName,
        })
        .from(ciPreviewAccess)
        .where(eq(ciPreviewAccess.projectId, projectId)),
      db
        .select({
          id: ciCheckIgnores.id,
          rule: ciCheckIgnores.rule,
          pathPattern: ciCheckIgnores.pathPattern,
        })
        .from(ciCheckIgnores)
        .where(eq(ciCheckIgnores.projectId, projectId)),
      db
        .select()
        .from(ciProjectSettings)
        .where(eq(ciProjectSettings.projectId, projectId)),
      db
        .select()
        .from(ciCheckRuns)
        .where(eq(ciCheckRuns.projectId, projectId))
        .orderBy(desc(ciCheckRuns.createdAt))
        .limit(RUN_LIMIT),
    ]);
  return {
    canManage: canManage(context),
    domain: project.domain,
    tokens,
    hosts,
    access: access ?? null,
    ignores,
    raiseOnHighTraffic: settings?.raiseOnHighTraffic ?? true,
    checkPreviewRobotsHeader: settings?.checkPreviewRobotsHeader ?? false,
    runs: runs.map(({ changedFiles: _files, tokenId: _token, ...row }) => row),
  };
}

async function run(
  context: OpportunityContext,
  input: { projectId: string; runId: string },
) {
  await authorize(context, input.projectId);
  const scope = (table: typeof ciCheckFindings | typeof ciCheckUrls) =>
    and(eq(table.projectId, input.projectId), eq(table.runId, input.runId));
  const [findings, urls] = await Promise.all([
    db.select().from(ciCheckFindings).where(scope(ciCheckFindings)),
    db.select().from(ciCheckUrls).where(scope(ciCheckUrls)),
  ]);
  return { findings, urls };
}

async function createToken(
  context: OpportunityContext,
  input: { projectId: string; name: string },
) {
  await manage(context, input.projectId);
  return createCiToken({ ...input, createdBy: context.userId });
}

async function revokeToken(
  context: OpportunityContext,
  input: { projectId: string; tokenId: string },
) {
  await manage(context, input.projectId);
  await revokeCiToken(input.projectId, input.tokenId);
}

async function addHost(
  context: OpportunityContext,
  input: { projectId: string; host: string },
) {
  await manage(context, input.projectId);
  const wildcard = input.host.trim().startsWith("*.");
  const host = normalizeCrawlerHost(input.host.trim().replace(/^\*\./, ""));
  if (!host) throw new AppError("VALIDATION_ERROR", "Enter a host name.");
  await db
    .insert(ciPreviewHosts)
    .values({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      host: wildcard ? `*.${host}` : host,
      createdBy: context.userId,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
}

async function removeHost(
  context: OpportunityContext,
  input: { projectId: string; hostId: string },
) {
  await manage(context, input.projectId);
  await db
    .delete(ciPreviewHosts)
    .where(
      and(
        eq(ciPreviewHosts.projectId, input.projectId),
        eq(ciPreviewHosts.id, input.hostId),
      ),
    );
}

/** One access method per project; null removes it. */
async function setAccess(
  context: OpportunityContext,
  input: {
    projectId: string;
    access:
      | { kind: "header"; headerName: string; value: string }
      | { kind: "cf_access"; clientId: string; clientSecret: string }
      | null;
  },
) {
  await manage(context, input.projectId);
  const { access } = input;
  const sealed = access
    ? await encryptToken(
        access.kind === "header"
          ? access.value
          : `${access.clientId}\n${access.clientSecret}`,
      )
    : null;
  await runBatch((tx) => [
    tx
      .delete(ciPreviewAccess)
      .where(eq(ciPreviewAccess.projectId, input.projectId)),
    ...(access && sealed
      ? [
          tx.insert(ciPreviewAccess).values({
            id: crypto.randomUUID(),
            projectId: input.projectId,
            kind: access.kind,
            headerName: access.kind === "header" ? access.headerName : null,
            encryptedValue: sealed.encryptedToken,
            keyVersion: sealed.tokenKeyVersion,
          }),
        ]
      : []),
  ]);
}

async function changeIgnore(
  context: OpportunityContext,
  input: {
    projectId: string;
    add?: { rule: string; pathPattern: string };
    removeId?: string;
  },
) {
  await manage(context, input.projectId);
  const audit = (summary: string) => ({
    organizationId: context.organizationId,
    projectId: input.projectId,
    actor: context,
    action: "seo_check.ignore_changed" as const,
    targetType: "project",
    targetId: input.projectId,
    summary,
  });
  await runBatch((tx) => [
    ...(input.add
      ? [
          tx.insert(ciCheckIgnores).values({
            id: crypto.randomUUID(),
            projectId: input.projectId,
            rule: input.add.rule,
            pathPattern: input.add.pathPattern,
            createdBy: context.userId,
            createdAt: new Date().toISOString(),
          }),
          auditInsert(
            tx,
            audit(`Ignored ${input.add.rule} on ${input.add.pathPattern}`),
          ),
        ]
      : []),
    ...(input.removeId
      ? [
          tx
            .delete(ciCheckIgnores)
            .where(
              and(
                eq(ciCheckIgnores.projectId, input.projectId),
                eq(ciCheckIgnores.id, input.removeId),
              ),
            ),
          auditInsert(tx, audit("Removed an ignore rule")),
        ]
      : []),
  ]);
}

async function saveSettings(
  context: OpportunityContext,
  input: {
    projectId: string;
    raiseOnHighTraffic: boolean;
    checkPreviewRobotsHeader: boolean;
  },
) {
  await manage(context, input.projectId);
  const values = {
    raiseOnHighTraffic: input.raiseOnHighTraffic,
    checkPreviewRobotsHeader: input.checkPreviewRobotsHeader,
    updatedAt: new Date().toISOString(),
  };
  await db
    .insert(ciProjectSettings)
    .values({ projectId: input.projectId, ...values })
    .onConflictDoUpdate({ target: ciProjectSettings.projectId, set: values });
}

/** RFC-0010 5.9: the daily retention task deletes runs after 90 days. */
export async function deleteCheckRunsBefore(cutoff: string) {
  const deleted = await db
    .delete(ciCheckRuns)
    .where(lt(ciCheckRuns.createdAt, cutoff))
    .returning({ id: ciCheckRuns.id });
  return deleted.length;
}

export const SeoCheckSettingsService = {
  get,
  run,
  createToken,
  revokeToken,
  addHost,
  removeHost,
  setAccess,
  changeIgnore,
  saveSettings,
};
