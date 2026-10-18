import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { splitTestPages, splitTests } from "@/db/schema";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { recordAudit } from "@/server/features/activity/auditLog";
import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import {
  authorize,
  type OpportunityContext,
} from "@/server/features/opportunities/services/opportunityAccess";
import {
  connectedGithub,
  withPublishingClaim,
} from "@/server/features/publishing/publishingAccess";
import { getConnection } from "@/server/features/publishing/repositories/publishingConnections";
import { sha256Hex } from "@/server/lib/audit/ids";
import { AppError } from "@/server/lib/errors";
import {
  checkVariantText,
  draftTemplate,
  type VariantDraft,
} from "./splitTestDraft";
import {
  diffCheck,
  pullBody,
  relativeImport,
  splitFiles,
  type SplitFile,
} from "./splitTestFiles";

// RFC-0011 5.4: Relay opens one pull request with the split files, the
// developer adds the template edit, and Relay checks the final diff. Every
// repository write follows the exact-change approval: the owner approves the
// hash of the files that Relay writes.
const filesSchema = z.array(z.object({ filename: z.string() })).max(100);

async function loadTest(
  context: OpportunityContext,
  input: { projectId: string; testId: string },
) {
  await authorize(context, input.projectId);
  requireOrgPermission(context, { integration: ["manage"] });
  const [test] = await db
    .select()
    .from(splitTests)
    .where(
      and(
        eq(splitTests.projectId, input.projectId),
        eq(splitTests.id, input.testId),
      ),
    );
  if (!test?.templatePath) throw new AppError("NOT_FOUND");
  const variants = await db
    .select({
      path: splitTestPages.path,
      originalTitle: splitTestPages.originalTitle,
      originalDescription: splitTestPages.originalDescription,
    })
    .from(splitTestPages)
    .where(
      and(
        eq(splitTestPages.projectId, input.projectId),
        eq(splitTestPages.testId, input.testId),
        eq(splitTestPages.bucket, "variant"),
      ),
    );
  const connection = await getConnection(input.projectId);
  if (!connection)
    throw new AppError(
      "CONFLICT",
      "Connect the repository in Project settings → Publishing first.",
    );
  const files = splitFiles(
    test.id,
    variants.map((row) => row.path),
    connection.rootDirectory,
  );
  return {
    test,
    templatePath: test.templatePath,
    connection,
    files,
    variants,
  };
}

type Loaded = Awaited<ReturnType<typeof loadTest>>;

/**
 * Phase 2: the drafted template edit, read from the base branch's head and
 * checked with the RFC-0004 rules on each variant page's final value.
 */
async function draftedTemplate(
  loaded: Loaded,
  draft: VariantDraft,
  client: Awaited<ReturnType<typeof connectedGithub>>,
  baseSha: string,
) {
  const { test, templatePath, files, variants } = loaded;
  if (test.field === "other")
    return {
      template: null,
      problems: ["Relay drafts titles and descriptions only."],
    };
  const current = await client.readFile(templatePath, baseSha);
  const drafted = draftTemplate({
    source: current.source,
    templatePath,
    field: test.field,
    draft,
    importPath: relativeImport(templatePath, files[1]?.path ?? ""),
  });
  return {
    template: {
      path: templatePath,
      source: drafted.source,
      blobSha: current.blobSha,
    },
    problems: [
      ...drafted.problems,
      ...checkVariantText(
        test.field,
        draft,
        variants.map((page) =>
          test.field === "title"
            ? page.originalTitle
            : page.originalDescription,
        ),
      ),
    ],
  };
}

const filesHash = (files: SplitFile[], template: SplitFile | null = null) =>
  sha256Hex(JSON.stringify(template ? [...files, template] : files));

/** What the owner approves: the exact files, their hash and the description. */
async function preview(
  context: OpportunityContext,
  input: { projectId: string; testId: string; draft?: VariantDraft },
) {
  const loaded = await loadTest(context, input);
  const { test, templatePath, files, connection } = loaded;
  if (!input.draft)
    return {
      files,
      problems: [],
      hash: await filesHash(files),
      body: pullBody(test, templatePath, files),
    };
  const client = await connectedGithub(
    connection,
    AbortSignal.timeout(60_000),
    {
      metadata: "read",
      contents: "read",
    },
  );
  const base = await client.getRef(connection.baseBranch);
  if (!base) throw new AppError("NOT_FOUND", "The base branch was not found.");
  const { template, problems } = await draftedTemplate(
    loaded,
    input.draft,
    client,
    base.sha,
  );
  const shown = template
    ? { path: template.path, source: template.source }
    : null;
  return {
    files: shown ? [...files, shown] : files,
    problems,
    hash: await filesHash(files, shown),
    body: pullBody(test, templatePath, files, Boolean(template)),
  };
}

async function open(
  context: OpportunityContext,
  input: {
    projectId: string;
    testId: string;
    hash: string;
    draft?: VariantDraft;
  },
) {
  const loaded = await loadTest(context, input);
  const { test, templatePath, connection, files } = loaded;
  if (test.status !== "eligible" || test.pullRequestNumber)
    throw new AppError("CONFLICT", "This test already has a pull request.");
  return withPublishingClaim(context, input.projectId, async (_, signal) => {
    const client = await connectedGithub(connection, signal);
    const base = await client.getRef(connection.baseBranch);
    if (!base)
      throw new AppError("NOT_FOUND", "The base branch was not found.");
    const drafted = input.draft
      ? await draftedTemplate(loaded, input.draft, client, base.sha)
      : null;
    if (drafted?.problems.length)
      throw new AppError("VALIDATION_ERROR", drafted.problems[0]);
    const template = drafted?.template ?? null;
    const shown = template
      ? { path: template.path, source: template.source }
      : null;
    if ((await filesHash(files, shown)) !== input.hash)
      throw new AppError(
        "CONFLICT",
        "The files changed since you reviewed them. Review them again.",
      );
    const branch = `relay/split-test-${test.id.slice(0, 8)}`;
    await client.createRef(branch, base.sha);
    for (const file of files)
      await client.updateFile({
        branch,
        path: file.path,
        source: file.source,
        message: `Add Relay split test files for ${test.name}`,
      });
    if (template)
      await client.updateFile({
        branch,
        path: template.path,
        source: template.source,
        blobSha: template.blobSha,
        message: `Draft the split test variant for ${test.name}`,
      });
    const pull = await client.createPullRequest({
      headBranch: branch,
      baseBranch: connection.baseBranch,
      title: `Split test: ${test.name}`,
      body: pullBody(test, templatePath, files, Boolean(template)),
    });
    const [updated] = await db
      .update(splitTests)
      .set({
        status: "awaiting_deploy",
        branch,
        pullRequestNumber: pull.number,
        pullRequestUrl: pull.url,
      })
      .where(
        and(
          eq(splitTests.id, test.id),
          eq(splitTests.status, "eligible"),
          isNull(splitTests.pullRequestNumber),
        ),
      )
      .returning({ id: splitTests.id });
    if (updated)
      await recordAudit({
        organizationId: context.organizationId,
        projectId: input.projectId,
        actor: context,
        action: "split_test.pr_opened",
        targetType: "split_test",
        targetId: test.id,
        summary: `Approved and opened ${connection.owner}/${connection.repository}#${pull.number} for the split test "${test.name}" (files ${input.hash.slice(0, 12)})`,
      });
    return { url: pull.url, number: pull.number };
  });
}

/** Checks the pull request's head and keeps the result. */
async function check(
  context: OpportunityContext,
  input: { projectId: string; testId: string },
) {
  const { test, templatePath, connection, files } = await loadTest(
    context,
    input,
  );
  if (!test.pullRequestNumber)
    throw new AppError("CONFLICT", "Open the pull request first.");
  const client = await connectedGithub(
    connection,
    AbortSignal.timeout(60_000),
    { metadata: "read", contents: "read", pull_requests: "read" },
  );
  const pull = await client.getPullRequest(test.pullRequestNumber);
  const changed = await client.request(
    `/pulls/${test.pullRequestNumber}/files?per_page=100`,
    filesSchema,
  );
  const read = (path: string) =>
    client.readFile(path, pull.headSha).then(
      (file) => file.source,
      () => null,
    );
  const [headJson, template] = await Promise.all([
    read(files[0]?.path ?? ""),
    read(templatePath),
  ]);
  const problems = diffCheck({
    changedFiles: changed.map((file) => file.filename),
    expected: files,
    headJson,
    template:
      template === null ? null : { path: templatePath, source: template },
    templatePath,
  });
  await db
    .update(splitTests)
    .set({
      checkedSha: pull.headSha,
      checkPassed: problems.length === 0,
      checkProblems: problems.join("\n") || null,
    })
    .where(eq(splitTests.id, test.id));
  return { problems, merged: pull.merged };
}

/**
 * 5.5 windows start from the confirmed production deployment: GitHub's
 * deployment of the merge commit, or the owner's attestation.
 */
async function confirmDeployment(
  context: OpportunityContext,
  input: { projectId: string; testId: string; attest: boolean },
) {
  const { test, connection } = await loadTest(context, input);
  if (test.status !== "awaiting_deploy" || !test.pullRequestNumber)
    throw new AppError("CONFLICT");
  const client = await connectedGithub(
    connection,
    AbortSignal.timeout(60_000),
    { metadata: "read", pull_requests: "read", deployments: "read" },
  );
  const pull = await client.getPullRequest(test.pullRequestNumber);
  if (!pull.merged || !pull.mergeCommitSha)
    return { ok: false, message: "Merge the pull request first." };
  if (!test.checkPassed || test.checkedSha !== pull.headSha)
    return {
      ok: false,
      message:
        "Check the pull request again. The last check must pass on the commit that was merged.",
    };
  let deployedAt: string | null = null;
  let basis = "attestation";
  const deployments = (
    await client.listDeployments(pull.mergeCommitSha)
  ).filter(
    (deployment) =>
      deployment.environment.toLowerCase() ===
      connection.productionEnvironment.toLowerCase(),
  );
  for (const deployment of deployments.slice(0, 5)) {
    const success = (await client.listDeploymentStatuses(deployment.id)).find(
      (status) => status.state === "success",
    );
    if (!success) continue;
    deployedAt = new Date(success.created_at).toISOString();
    basis = "github_deployment";
    break;
  }
  if (!deployedAt && !input.attest)
    return {
      ok: false,
      message: `GitHub reports no successful "${connection.productionEnvironment}" deployment of the merge commit. Confirm it yourself if it is live.`,
    };
  deployedAt ??= new Date().toISOString();
  const day = ga4DateInTimeZone(new Date(deployedAt), "America/Los_Angeles");
  const observationStart = shiftGa4Date(day, 7);
  const [updated] = await db
    .update(splitTests)
    .set({
      status: "verifying",
      deployedAt,
      deploymentBasis: basis,
      observationStart,
      observationEnd: shiftGa4Date(observationStart, 27),
    })
    .where(
      and(eq(splitTests.id, test.id), eq(splitTests.status, "awaiting_deploy")),
    )
    .returning({ id: splitTests.id });
  if (updated)
    await recordAudit({
      organizationId: context.organizationId,
      projectId: input.projectId,
      actor: context,
      action: "split_test.deployment_confirmed",
      targetType: "split_test",
      targetId: test.id,
      summary: `Confirmed the production deployment of the split test "${test.name}" (${basis === "github_deployment" ? "GitHub deployment" : "owner attestation"})`,
    });
  return {
    ok: true,
    message: "Deployment confirmed. Live verification is next.",
  };
}

export const SplitTestPullService = { preview, open, check, confirmDeployment };
