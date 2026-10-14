# Approved GitHub metadata proposals

## Scope

The first publishing workflow turns an approved opportunity into an immutable, reviewable change to one existing static Next.js page metadata description. It does not generate product claims, create pages, modify titles or layouts, auto-merge, or deploy. Opportunity approval authorizes proposal preparation only. A separate explicit approval authorizes the exact branch, commit and pull request operation.

The author supplies the replacement description. The application reads only repository metadata, the selected application's package manifest and the selected page at an immutable commit. It parses the page without executing repository code, replaces one string literal, and reparses the result. Repository CI remains the authority for the complete application build. Static validation is never presented as a successful repository build.

## Connection and authorization

The initial connection uses a fine-grained GitHub personal access token restricted to one selected repository, with Contents and Pull requests write permissions. Users explicitly authorize the connection check. The server pins operations to the saved repository identity, branch and optional application root. Tokens are encrypted using the application's configured encryption secret and never returned to clients. Missing secure configuration fails closed. Replacing or disconnecting a connection revokes its local credential and invalidates unexecuted proposals tied to that connection revision.

A GitHub App is the preferred later credential transport because installations provide a better repository selection and revocation experience. Implementing that transport now would introduce a new application registration and installation lifecycle before the first bounded execution workflow exists. Fine-grained tokens make the initial workflow usable without a separate OAuth system. The application cannot prove that a user selected the narrowest token permissions, so the connection instructions explicitly describe the required scope. Classic tokens are rejected. The proposal and execution model does not depend on token transport.

Project membership authorizes viewing. Existing integration-management permission authorizes connecting, preparing and executing. All service operations check the current project organization. Persisted mutations additionally fence project ownership, active connection revision and the current execution claim. Approval checks current Search Console property and evidence freshness in the same persistence operation as the execution record.

## Proposal identity

A proposal binds a project, opportunity, evidence run, opportunity version, connection revision, URL, page path, base commit, before and after Git blob hashes, before and after description snippets, and a SHA-256 change fingerprint. It records the reason, expected effect, risk, verification plan, validation summary and author. Full repository source is not retained. Execution refetches the immutable source, reconstructs the patch and checks the exact fingerprint and blob hashes.

Supported targets are static `app/.../page` or `src/app/.../page` files in JavaScript or TypeScript. Dynamic segments, route groups, parallel or intercepting routes, client components, generated metadata, indirect or mutable metadata and unsupported syntax are rejected instead of guessed. The URL path must match the selected page path. Only a direct existing string description in a static metadata object is changed.

## Durable execution

Connections, proposals, approvals, execution attempts and execution events are separate normalized records. Existing project refresh claims serialize publishing operations. A bounded operation deadline is shorter than the claim lease. An expired worker cannot persist a later result over its successor.

Every external write follows a persisted exact-change approval. A deterministic proposal branch supports recovery after an interrupted response. Before reusing that branch, the server verifies its parent, one-file change and expected blob. Existing pull requests must match the repository, head, base and proposal marker. Unexpected branch contents fail closed. There is no automatic retry of a write with an uncertain outcome. A user-authorized retry reconciles GitHub state first.

A created pull request leaves the opportunity in progress. Merged and deployed are separate later observations, not inferred from pull request creation. Failure history remains visible. Disconnecting does not close existing pull requests or revert repository changes.

## Boundaries and alternatives

The provider client uses a fixed GitHub API origin, strict response validation, bounded requests and response sizes, cancellation and sanitized errors. It does not fetch URLs supplied in provider responses, follow redirects, log tokens, or send repository code to an AI provider. Repository tree entries are checked to reject symlinks and submodules rather than trusting the contents endpoint to distinguish them.

A universal CMS abstraction, arbitrary agent shell access, whole-repository indexing and automatic code execution were rejected for this release. They widen access and failure modes without improving the first useful result. Framework support can expand through small adapters after the static description workflow is reliable. WordPress, Webflow and other publishing systems can reuse the opportunity, approval and execution records without sharing Git-specific transport code.
