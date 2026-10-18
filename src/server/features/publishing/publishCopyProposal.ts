import { AppError } from "@/server/lib/errors";
import type {
  ExecutionPhase,
  MetadataProposal,
  ProposalTextEdit,
  PublishingConnection,
} from "@/types/schemas/publishing";
import { applyCopyEdits } from "./copyChange";
import type { GithubClient, GithubPullRequest } from "./githubClient";

type Checkpoint = (
  phase: ExecutionPhase,
  message: string,
  values?: {
    commitSha?: string;
    pullRequestNumber?: number;
    pullRequestUrl?: string;
  },
) => Promise<void>;

/**
 * Rebuilds the approved edits from the base commit. The result must match
 * the stored edits exactly, or nothing is written.
 */
async function rebuild(
  client: GithubClient,
  proposal: MetadataProposal,
  textEdits: ProposalTextEdit[],
) {
  const paths = [...new Set(textEdits.map((edit) => edit.filePath))];
  const sources = new Map(
    await Promise.all(
      paths.map(
        async (path) =>
          [path, await client.readFile(path, proposal.baseSha)] as const,
      ),
    ),
  );
  const page =
    sources.get(proposal.filePath) ??
    (await client.readFile(proposal.filePath, proposal.baseSha));
  const rebuilt = await applyCopyEdits(
    sources,
    textEdits.map(({ filePath, beforeText, afterText }) => ({
      filePath,
      beforeText,
      afterText,
    })),
  );
  if (
    !textEdits.length ||
    page.blobSha !== proposal.beforeBlobSha ||
    JSON.stringify(rebuilt.textEdits) !== JSON.stringify(textEdits)
  )
    throw new AppError(
      "CONFLICT",
      "The repository changed since this text change was prepared. Prepare it again.",
    );
  return rebuilt.files;
}

/** RFC-0012 5.4: one commit with every text edit, then one pull request. */
export async function publishCopyProposal(
  client: GithubClient,
  proposal: MetadataProposal,
  textEdits: ProposalTextEdit[],
  connection: PublishingConnection,
  checkpoint: Checkpoint,
) {
  const files = await rebuild(client, proposal, textEdits);
  const branchName = `growth/${proposal.id}`;
  const urlPath = new URL(proposal.targetUrl).pathname;
  const refs = { headBranch: branchName, baseBranch: connection.baseBranch };
  const marker = `<!-- OpenSEO proposal:${proposal.id} change:${proposal.changeHash} -->`;
  const verifyCommit = async (sha: string) => {
    const commit = await client.getCommit(sha);
    if (
      commit.parents.length !== 1 ||
      commit.parents[0] !== proposal.baseSha ||
      !(await client.verifyCommitFiles({
        baseSha: proposal.baseSha,
        headSha: sha,
        files: files.map(({ path, blobSha }) => ({ path, blobSha })),
      }))
    )
      throw new AppError("CONFLICT");
  };
  const verifyPull = async (pull: GithubPullRequest, expectedHead?: string) => {
    if (
      pull.repositoryId !== connection.repositoryId ||
      pull.headRef !== branchName ||
      pull.baseRef !== connection.baseBranch ||
      !pull.body.includes(marker) ||
      (pull.state === "closed" && !pull.merged) ||
      (expectedHead && pull.headSha !== expectedHead)
    )
      throw new AppError("CONFLICT");
    await verifyCommit(pull.headSha);
  };
  // An interrupted run may already have opened the pull request.
  const existing = await client.findPullRequest(refs);
  if (existing) {
    await verifyPull(existing);
    await checkpoint(
      "pull_request_created",
      "Recovered the existing exact-change pull request. No new GitHub write was needed.",
      {
        commitSha: existing.headSha,
        pullRequestNumber: existing.number,
        pullRequestUrl: existing.url,
      },
    );
    return;
  }
  const base = await client.getRef(connection.baseBranch);
  if (base?.sha !== proposal.baseSha) throw new AppError("CONFLICT");
  const summary = textEdits
    .map(
      (edit) =>
        `- \`${edit.filePath}\`: "${edit.beforeText}" → "${edit.afterText}"`,
    )
    .join("\n");
  // The commit comes first, so the branch never points at a partial change.
  let commitSha = (await client.getRef(branchName))?.sha;
  if (commitSha) await verifyCommit(commitSha);
  else {
    ({ commitSha } = await client.commitFiles({
      baseSha: proposal.baseSha,
      files: files.map(({ path, source }) => ({ path, source })),
      message: `Copy: update reviewed page text (${proposal.id})`,
    }));
    await verifyCommit(commitSha);
    await client.createRef(branchName, commitSha);
  }
  await checkpoint(
    "branch_created",
    "Proposal branch verified. No merge or deployment requested.",
  );
  await checkpoint(
    "file_committed",
    `Verified one commit changing only the approved text in ${files.length} file${files.length === 1 ? "" : "s"}.`,
    { commitSha },
  );
  if (
    (await client.getRef(branchName))?.sha !== commitSha ||
    (await client.getRef(connection.baseBranch))?.sha !== proposal.baseSha
  )
    throw new AppError("CONFLICT");
  const pull = await client.createPullRequest({
    ...refs,
    title: `Copy: update page text for ${urlPath}`,
    body: `${marker}\n\n## What changes\n\nReplace page text in one commit. The exact proposal was approved in the growth queue.\n\n${summary}\n\n## Review before merging\n\n${proposal.risk}\n\nCheck every claim and the diff. Run this repository's build and tests. Static parsing passed, but the repository build and CI were not run by the platform. Conversions are not guaranteed.\n\nNo auto-merge or deployment was requested. Confirm deployment separately before measuring results.\n\nApproved base: \`${proposal.baseSha}\`\nChange fingerprint: \`${proposal.changeHash}\``,
  });
  await verifyPull(pull, commitSha);
  await checkpoint(
    "pull_request_created",
    "Created and verified the approved pull request. Awaiting your merge and deployment.",
    { commitSha, pullRequestNumber: pull.number, pullRequestUrl: pull.url },
  );
}
