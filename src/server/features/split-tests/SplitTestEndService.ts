import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { splitTestAnalyses, splitTests } from "@/db/schema";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { recordAudit } from "@/server/features/activity/auditLog";
import {
  authorize,
  type OpportunityContext,
} from "@/server/features/opportunities/services/opportunityAccess";
import {
  authorizeApproval,
  connectedGithub,
  withPublishingClaim,
} from "@/server/features/publishing/publishingAccess";
import { getConnection } from "@/server/features/publishing/repositories/publishingConnections";
import { sha256Hex } from "@/server/lib/audit/ids";
import { AppError } from "@/server/lib/errors";
import { endTemplate } from "./splitTestEnd";
import { splitFiles } from "./splitTestFiles";

// RFC-0011 5.7: "Apply to all pages" or "Remove test" opens one pull request
// that leaves no split code. The owner approves the exact change by its hash.
type Action = "apply" | "remove";
const DEPLOYED = new Set(["verifying", "running", "stopped", "concluded"]);

async function plan(
  context: OpportunityContext,
  input: { projectId: string; testId: string; action: Action },
  signal: AbortSignal,
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
  if (!test?.templatePath || !DEPLOYED.has(test.status) || test.endAction)
    throw new AppError(
      "CONFLICT",
      "This test cannot end with a pull request now.",
    );
  if (input.action === "apply") {
    const [latest] = await db
      .select({ label: splitTestAnalyses.label })
      .from(splitTestAnalyses)
      .where(
        and(
          eq(splitTestAnalyses.projectId, input.projectId),
          eq(splitTestAnalyses.testId, input.testId),
        ),
      )
      .orderBy(desc(splitTestAnalyses.runAt))
      .limit(1);
    if (test.status !== "concluded" || latest?.label === "negative")
      throw new AppError(
        "CONFLICT",
        "Apply a change only after the window ends without a negative result.",
      );
  }
  const connection = await getConnection(input.projectId);
  if (!connection)
    throw new AppError(
      "CONFLICT",
      "Connect the repository in Project settings → Publishing first.",
    );
  const client = await connectedGithub(connection, signal);
  const base = await client.getRef(connection.baseBranch);
  if (!base) throw new AppError("NOT_FOUND", "The base branch was not found.");
  const template = await client.readFile(test.templatePath, base.sha);
  const rewritten = endTemplate(
    template.source,
    test.templatePath,
    input.action,
  );
  const deletions = await Promise.all(
    splitFiles(test.id, [], connection.rootDirectory).map(async (file) => ({
      path: file.path,
      blobSha: await client
        .readFile(file.path, base.sha)
        .then((found) => found.blobSha)
        .catch(() => null),
    })),
  );
  const change = {
    action: input.action,
    baseSha: base.sha,
    template: { path: test.templatePath, after: rewritten.source },
    deleted: deletions.flatMap((file) => (file.blobSha ? [file.path] : [])),
  };
  return {
    test,
    connection,
    client,
    template,
    deletions,
    rewritten,
    change,
    hash: await sha256Hex(JSON.stringify(change)),
  };
}

/** What the owner approves: the template before and after, and the deletions. */
async function preview(
  context: OpportunityContext,
  input: { projectId: string; testId: string; action: Action },
) {
  const planned = await plan(context, input, AbortSignal.timeout(60_000));
  return {
    problems: planned.rewritten.problems,
    templatePath: planned.change.template.path,
    before: planned.template.source,
    after: planned.rewritten.source,
    deleted: planned.change.deleted,
    hash: planned.hash,
  };
}

async function end(
  context: OpportunityContext,
  input: { projectId: string; testId: string; action: Action; hash: string },
) {
  // Another organization gets "not found", never the claim's conflict.
  await authorizeApproval(context, input.projectId);
  return withPublishingClaim(context, input.projectId, async (_, signal) => {
    const planned = await plan(context, input, signal);
    const { test, connection, client, template } = planned;
    if (planned.rewritten.problems.length)
      throw new AppError("VALIDATION_ERROR", planned.rewritten.problems[0]);
    if (planned.hash !== input.hash)
      throw new AppError(
        "CONFLICT",
        "The repository changed since you reviewed this change. Review it again.",
      );
    const branch = `relay/split-test-${test.id.slice(0, 8)}-${input.action}`;
    const message =
      input.action === "apply"
        ? `Apply the split test change to all pages: ${test.name}`
        : `Remove the split test: ${test.name}`;
    await client.createRef(branch, planned.change.baseSha);
    await client.updateFile({
      branch,
      path: planned.change.template.path,
      source: planned.change.template.after,
      blobSha: template.blobSha,
      message,
    });
    for (const file of planned.deletions)
      if (file.blobSha)
        await client.deleteFile({
          branch,
          path: file.path,
          blobSha: file.blobSha,
          message,
        });
    const pull = await client.createPullRequest({
      headBranch: branch,
      baseBranch: connection.baseBranch,
      title:
        input.action === "apply"
          ? `Split test: apply "${test.name}" to all pages`
          : `Split test: remove "${test.name}"`,
      body: `${message}.\n\nThis pull request removes \`inSplitVariant\` from \`${planned.change.template.path}\`${input.action === "apply" ? " and keeps the variant value for every page" : " and keeps the current value"}, and deletes the split files. After it merges, no split code is left.`,
    });
    await db
      .update(splitTests)
      .set({
        endAction: input.action,
        endPullRequestUrl: pull.url,
        status: test.status === "concluded" ? "concluded" : "stopped",
      })
      .where(eq(splitTests.id, test.id));
    await recordAudit({
      organizationId: context.organizationId,
      projectId: input.projectId,
      actor: context,
      action: "split_test.ended",
      targetType: "split_test",
      targetId: test.id,
      summary: `Approved and opened ${connection.owner}/${connection.repository}#${pull.number} to ${input.action === "apply" ? "apply" : "remove"} the split test "${test.name}"`,
    });
    return { url: pull.url };
  });
}

export const SplitTestEndService = { preview, end };
