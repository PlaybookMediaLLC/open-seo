import { AppError } from "@/server/lib/errors";
import type {
  ExecutionPhase,
  MetadataProposal,
  PublishingConnection,
} from "@/types/schemas/publishing";
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

export async function publishProposal(
  client: GithubClient,
  proposal: MetadataProposal,
  connection: PublishingConnection,
  afterSource: string,
  checkpoint: Checkpoint,
) {
  const branchName = `growth/${proposal.id}`;
  const fields = [
    proposal.titleAfter !== null && "title",
    proposal.descriptionAfter !== proposal.descriptionBefore && "description",
    proposal.canonicalAfter !== null && "canonical URL",
    proposal.robotsAfter !== null && "robots",
  ]
    .filter(Boolean)
    .join(" and ");
  const urlPath = new URL(proposal.targetUrl).pathname;
  const refs = { headBranch: branchName, baseBranch: connection.baseBranch };
  const marker = `<!-- OpenSEO proposal:${proposal.id} change:${proposal.changeHash} -->`;
  const verifyCommit = async (sha: string) => {
    const commit = await client.getCommit(sha);
    if (
      commit.parents.length !== 1 ||
      commit.parents[0] !== proposal.baseSha ||
      !(await client.verifySingleFileCommit({
        baseSha: proposal.baseSha,
        headSha: sha,
        path: proposal.filePath,
        blobSha: proposal.afterBlobSha,
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
  // An interrupted create may already have succeeded. Recover that exact PR
  // before checking whether the base has advanced, without writing again.
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
  let head = await client.getRef(branchName);
  if (!head) head = await client.createRef(branchName, proposal.baseSha);
  if (head.sha !== proposal.baseSha) await verifyCommit(head.sha);
  await checkpoint(
    "branch_created",
    "Proposal branch verified. No merge or deployment requested.",
  );
  let commitSha = head.sha;
  if (head.sha === proposal.baseSha) {
    const updated = await client.updateFile({
      branch: branchName,
      path: proposal.filePath,
      source: afterSource,
      blobSha: proposal.beforeBlobSha,
      message: `SEO: update reviewed page ${fields} (${proposal.id})`,
    });
    if (updated.blobSha !== proposal.afterBlobSha)
      throw new AppError("CONFLICT");
    commitSha = updated.commitSha;
    await verifyCommit(commitSha);
  }
  await checkpoint(
    "file_committed",
    `Verified one commit changing only the approved page ${fields}.`,
    { commitSha },
  );
  // Reject a concurrent branch push or base movement before opening a fresh PR.
  if (
    (await client.getRef(branchName))?.sha !== commitSha ||
    (await client.getRef(connection.baseBranch))?.sha !== proposal.baseSha
  )
    throw new AppError("CONFLICT");
  const pull = await client.createPullRequest({
    ...refs,
    title: `SEO: update ${fields} for ${urlPath}`,
    body: `${marker}\n\n## What changes\n\nReplace the existing static Next.js metadata ${fields} in \`${proposal.filePath}\`. The exact proposal was approved in the growth queue.\n\n## Review before merging\n\nCheck the product claims and diff. Run this repository's build and tests. Static parsing passed, but the repository build, custom routing and CI were not run by the platform. Search engines may rewrite snippets, and traffic or revenue gains are not guaranteed.\n\nNo auto-merge or deployment was requested. Confirm deployment separately before measuring results.\n\nApproved base: \`${proposal.baseSha}\`\nChange fingerprint: \`${proposal.changeHash}\``,
  });
  await verifyPull(pull, commitSha);
  await checkpoint(
    "pull_request_created",
    "Created and verified the approved pull request. Awaiting your merge and deployment.",
    { commitSha, pullRequestNumber: pull.number, pullRequestUrl: pull.url },
  );
}
