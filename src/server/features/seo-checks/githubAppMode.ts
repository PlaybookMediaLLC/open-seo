import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  ciCheckFindings,
  ciCheckRuns,
  ciCheckUrls,
  ciWebhookDeliveries,
  githubAppInstallations,
  projects,
  publishingConnections,
} from "@/db/schema";
import {
  API,
  githubJson,
  installationToken,
} from "@/server/features/publishing/githubApp";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import { readRequestText } from "@/server/lib/request-body";
import { AppError } from "@/server/lib/errors";
import { gateSummary, gateTrend, parseGateConfig } from "@/shared/releaseGate";
import { queueCheck, recentBlocking } from "./CheckApi";

// RFC-0010 5.12: GitHub App mode. A successful preview deployment of a pull
// request starts a check with no workflow step, and the result comes back
// as a Check Run with annotations on the changed files.
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_ANNOTATIONS = 50;
const encoder = new TextEncoder();

function hexBytes(hex: string) {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) =>
    Number.parseInt(pair, 16),
  );
}

/**
 * Checks the signature and claims the delivery id. 404 when App mode is off,
 * 401 for a bad signature; a redelivery comes back as a duplicate.
 */
export async function verifyWebhook(request: Request) {
  const secret = await getOptionalEnvValue("GITHUB_APP_WEBHOOK_SECRET");
  if (!secret) return { ok: false as const, status: 404 };
  const signature = request.headers
    .get("x-hub-signature-256")
    ?.match(/^sha256=([0-9a-f]{64})$/)?.[1];
  const delivery = request.headers.get("x-github-delivery");
  const event = request.headers.get("x-github-event");
  if (!signature || !delivery || !event)
    return { ok: false as const, status: 401 };
  const body = await readRequestText(request, MAX_BODY_BYTES);
  if (body === null) return { ok: false as const, status: 413 };
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    hexBytes(signature),
    encoder.encode(body),
  );
  if (!valid) return { ok: false as const, status: 401 };
  const claimed = await db
    .insert(ciWebhookDeliveries)
    .values({ id: delivery, event, receivedAt: new Date().toISOString() })
    .onConflictDoNothing()
    .returning({ id: ciWebhookDeliveries.id });
  return {
    ok: true as const,
    event,
    delivery,
    duplicate: claimed.length === 0,
    payload: JSON.parse(body) as unknown,
  };
}

/** Frees a delivery id after a failure, so a redelivery runs again. */
export async function releaseDelivery(id: string) {
  await db.delete(ciWebhookDeliveries).where(eq(ciWebhookDeliveries.id, id));
}

const deploymentSchema = z.object({
  deployment_status: z.object({
    state: z.string(),
    environment_url: z.string().nullish(),
    target_url: z.string().nullish(),
  }),
  deployment: z.object({
    sha: z.string().regex(/^[0-9a-f]{40}$/),
    environment: z.string(),
  }),
  repository: z.object({ id: z.number(), full_name: z.string() }),
  installation: z.object({ id: z.number() }),
});
const pullsSchema = z.array(
  z.object({
    number: z.number(),
    state: z.string(),
    labels: z.array(z.object({ name: z.string() })),
  }),
);
const filesSchema = z.array(z.object({ filename: z.string() }));

/** Starts a check for a successful preview deployment of an open PR. */
export async function handleDeploymentStatus(payload: unknown) {
  const parsed = deploymentSchema.safeParse(payload);
  if (!parsed.success) return "ignored";
  const {
    deployment_status: status,
    deployment,
    repository,
    installation,
  } = parsed.data;
  const previewUrl = status.environment_url ?? status.target_url;
  if (status.state !== "success" || !previewUrl?.startsWith("https://"))
    return "ignored";
  const repositoryId = String(repository.id);
  // Projects connected to this repository through this installation.
  const targets = await db
    .select({
      projectId: projects.id,
      organizationId: projects.organizationId,
      domain: projects.domain,
      productionEnvironment: publishingConnections.productionEnvironment,
    })
    .from(publishingConnections)
    .innerJoin(projects, eq(projects.id, publishingConnections.projectId))
    .innerJoin(
      githubAppInstallations,
      eq(githubAppInstallations.id, publishingConnections.installationRef),
    )
    .where(
      and(
        eq(publishingConnections.repositoryId, repositoryId),
        eq(publishingConnections.transport, "github_app"),
        isNull(publishingConnections.revokedAt),
        eq(githubAppInstallations.installationId, installation.id),
        isNull(githubAppInstallations.revokedAt),
        isNull(projects.archivedAt),
      ),
    );
  const previews = targets.filter(
    (target) => target.productionEnvironment !== deployment.environment,
  );
  if (!previews.length) return "ignored";
  const token = await installationToken({
    installationId: installation.id,
    repositoryId,
    permissions: { metadata: "read", pull_requests: "read", contents: "read" },
  });
  const repo = `${API}/repos/${repository.full_name}`;
  const pulls = await githubJson(
    `${repo}/commits/${deployment.sha}/pulls`,
    pullsSchema,
    { token },
  );
  const pull = pulls.find((entry) => entry.state === "open");
  if (!pull) return "ignored";
  // ponytail: one page of 100 files; the URL selection uses at most 300.
  const files = await githubJson(
    `${repo}/pulls/${pull.number}/files?per_page=100`,
    filesSchema,
    { token },
  );
  // RFC-0015 5.4: the repository's relay-gate.json at the commit, if any.
  const gateConfig = await githubJson(
    `${repo}/contents/relay-gate.json?ref=${deployment.sha}`,
    z.object({ encoding: z.literal("base64"), content: z.string() }),
    { token },
  ).then(
    (file) =>
      new TextDecoder().decode(
        Uint8Array.from(atob(file.content.replace(/\s/g, "")), (char) =>
          char.charCodeAt(0),
        ),
      ),
    (error: unknown) => {
      if (error instanceof AppError && error.code === "NOT_FOUND")
        return undefined;
      throw error;
    },
  );
  const results = await Promise.all(
    previews.map(({ productionEnvironment: _env, ...target }) =>
      queueCheck(
        { ...target, tokenId: null },
        {
          previewUrl,
          repository: repository.full_name,
          pullRequest: pull.number,
          headSha: deployment.sha,
          changedFiles: files.map((file) => file.filename),
          override: pull.labels.some(
            (label) => label.name === "relay-seo-override",
          ),
          gateConfig,
        },
        { source: "app", installationId: installation.id },
      ),
    ),
  );
  return results.map((result) =>
    result.status < 300 ? "queued" : String(result.body.error),
  );
}

/** Posts the finished run as a Check Run, with annotations on mapped files. */
export async function reportCheckRun(runId: string) {
  const [run] = await db
    .select()
    .from(ciCheckRuns)
    .where(eq(ciCheckRuns.id, runId));
  if (!run || run.source !== "app" || !run.installationId) return;
  const [findings, urls] = await Promise.all([
    db.select().from(ciCheckFindings).where(eq(ciCheckFindings.runId, runId)),
    db.select().from(ciCheckUrls).where(eq(ciCheckUrls.runId, runId)),
  ]);
  const blocked = run.blockingCount > 0 && !run.overrideUsed;
  const gate = run.gateConfig ? parseGateConfig(run.gateConfig) : null;
  const summary = [
    gateSummary(findings, gate && "config" in gate ? gate.config.ignore : []),
    gateTrend(await recentBlocking(run)),
  ]
    .filter(Boolean)
    .join("\n\n");
  const annotations = findings.flatMap((finding) => {
    const file = urls.find((url) => url.path === finding.path)?.sourceFile;
    return file
      ? [
          {
            path: file,
            start_line: 1,
            end_line: 1,
            annotation_level:
              finding.severity === "blocking" ? "failure" : "warning",
            title: `${finding.rule} on ${finding.path}`,
            message: [finding.message, finding.beforeValue, finding.afterValue]
              .filter(Boolean)
              .join("\n"),
          },
        ]
      : [];
  });
  const [connection] = await db
    .select({ repositoryId: publishingConnections.repositoryId })
    .from(publishingConnections)
    .where(
      and(
        eq(publishingConnections.projectId, run.projectId),
        eq(publishingConnections.transport, "github_app"),
        isNull(publishingConnections.revokedAt),
      ),
    );
  if (!connection) return;
  const token = await installationToken({
    installationId: run.installationId,
    repositoryId: connection.repositoryId,
    permissions: { checks: "write" },
  });
  await githubJson(`${API}/repos/${run.repository}/check-runs`, z.unknown(), {
    token,
    method: "POST",
    body: {
      name: "Relay SEO check",
      head_sha: run.headSha,
      status: "completed",
      conclusion:
        run.status === "failed" ? "neutral" : blocked ? "failure" : "success",
      output: {
        title:
          run.status === "failed"
            ? "Relay could not complete the check"
            : `${run.blockingCount} blocking, ${run.warningCount} warnings`,
        summary: (
          summary || `${run.urlCount} pages checked. No findings.`
        ).slice(0, 60_000),
        annotations: annotations.slice(0, MAX_ANNOTATIONS),
      },
    },
  });
}
