# GitHub metadata proposals

Connect one GitHub repository to a project to prepare a reviewable change to an existing Next.js page description. You write the replacement description. The platform checks the supported syntax, shows the before and after text, and creates a pull request only after a separate explicit approval.

It never auto-merges, deploys, or reverts a change. Pull request creation can trigger your repository's existing CI, including any costs or preview deployments your own workflows configure.

## Connect a repository

An organization owner or administrator can connect a repository in **Settings → Integrations → GitHub publishing**.

1. In GitHub, create a **fine-grained personal access token** with an expiration date. Select only the repository you intend to connect.
2. Grant **Contents: Read and write** and **Pull requests: Read and write**. Do not grant Workflows write permission for this feature. Your organization may require token approval before it works.
3. Enter the repository owner, repository name and an existing base branch. For a monorepo, enter the application directory, such as `apps/web`, without a leading or trailing slash.
4. Paste the token and explicitly authorize the connection check.

The check reads repository metadata and verifies the selected branch. It does not create a branch, commit or pull request. The token is encrypted at rest and is never displayed again. The application restricts its operations to the configured repository and branch, but cannot prove that the token itself has no additional permissions. Keep its GitHub scope narrow.

The initial release uses fine-grained tokens, not a GitHub App installation. Classic tokens are not accepted.

## Prepare a description proposal

1. Open an opportunity and inspect its evidence and uncertainty.
2. Mark the current evidence reviewed and approve **proposal preparation**. This approval does not authorize GitHub writes.
3. In the GitHub proposal panel, enter the repository-relative page path and your replacement description. Include the application directory prefix if you configured one.
4. Choose **Prepare verified proposal**.
5. Inspect the original and proposed descriptions, target repository, branch, path, base commit, change fingerprint, risk and verification plan.

Preparation reads the selected application's `package.json` and the selected page at an immutable commit. It does not index the repository or send source code to an AI model. The manifest must declare a recognizable Next.js version, such as `^15.0.0`, with metadata API support from Next.js 13.2 onward. Aliases and unusual version expressions are rejected rather than guessed.

Supported files are static `app/.../page.ts`, `page.tsx`, `page.js` or `page.jsx`, optionally under `src/app`. The page must directly export a constant metadata object with an existing string `description`. The URL path must correspond directly to the file path. Dynamic routes, route groups, layouts, client components, generated or indirect metadata, symlinks and unsupported syntax are rejected. Custom routing, rewrites and `basePath` are not verified.

Only the description literal changes. Everything around it remains byte-for-byte unchanged. The source must be valid UTF-8 and at most 32 KiB. This is static syntax validation, **not a completed application build**. The full repository build and tests must still run in your CI. Check the description's product claims yourself. Search engines may choose another snippet, and no traffic or revenue improvement is guaranteed.

## Approve and create a pull request

Select the explicit pull-request authorization checkbox and confirm the exact proposal. This separate approval records your identity, note and the proposal fingerprint before any GitHub write.

The platform rechecks the source and repository, creates a proposal-specific branch, makes one verified file change and opens a pull request. It refuses an unexpected branch, changed base commit, altered source or stale evidence instead of silently rebasing your approval. The opportunity remains **In progress**, not Implemented.

Review the full diff and CI results in GitHub. Merge and deploy through your normal process. To compare Search Console results before and after the change, choose **Track results** on the successful attempt. See [Experiments and results](EXPERIMENTS.md). Deployment is confirmed by you, not detected automatically.

## Failures and recovery

Execution history shows attempts, checkpoints and sanitized errors. A failed response can mean that GitHub accepted a write but its result was not recorded locally. Do not assume failure means nothing happened.

An explicitly authorized retry checks for the exact existing branch, commit and pull request before writing again. It never automatically merges or removes remote work. Wait for an interrupted operation's three-minute lease to expire before retrying.

If the base branch advanced or you need a fresh connection, use **Re-review failed execution**. The platform checks the original repository and base branch for the failed attempt's pull request. An open or merged pull request blocks replacement. Reconcile the existing exact proposal instead, or close an unwanted unmerged pull request yourself. Once no open or merged pull request is found, the opportunity returns to Reviewed and requires a fresh approval and proposal. Existing branches and audit history remain intact.

Replacing or disconnecting a connection removes its stored credential and invalidates unexecuted proposals tied to that connection revision. It does not revoke the token at GitHub, close pull requests, delete branches or undo commits. Revoke an unused token in GitHub separately. Recovery after replacement requires access to the original repository and base branch.

## Limits and self-hosting

Each publishing operation has a 90-second provider deadline, a maximum of 32 GitHub requests, bounded response sizes and no automatic write retries. Connection checks use at most two requests. Project-level leases prevent overlapping publishing operations. No paid DataForSEO or AI calls are part of this workflow.

Apply the paired database migrations using your existing SQLite/D1 or Postgres update procedure. Configure a stable, high-entropy `BETTER_AUTH_SECRET` of at least 32 characters before connecting GitHub. Publishing fails closed when this encryption configuration is missing. Rotating the secret requires reconnecting stored GitHub credentials. Do not expose local-noauth mode to an untrusted network.

Provider tokens do not belong in Git, screenshots, reports or support logs. Members can inspect proposals, but only owners and administrators can manage the connection, prepare a proposal, authorize execution or recover a failed attempt.
