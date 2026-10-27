# Agent guidance

## Engineering principles

- Prefer simple, readable, flat code with minimal indirection.
- Work on bugs a real user hit or would plausibly hit. Don't open a ticket or PR for an edge case found only by reading the code; flag it instead. Security holes and significant billing abuse are the exception.
- Keep product data normalized and relationships explicit. Do not encode relational data in JSON or text merely to avoid joins.
- For new application-backed backend functionality, default to: TanStack server function → service → repository.
- Keep schema changes, queries, and mutations compatible with both SQLite and Postgres.
- Prefer idiomatic TanStack Query, Router, and Form patterns for server state, routing, and submitted forms.
- shadcn components in `src/client/components/ui/` are built on Base UI, not Radix. Compose them with the `render` prop, not `asChild`.
- Specs under `docs/maintainers/specs/` are public design records: what a feature does, how it works, the alternatives considered and why they lost. No line numbers, migration mechanics, test plans, incidents, costs, or internal infrastructure details.

## Reuse before writing new code

Before you add a component, hook, Zod schema, type, query, repository, service, MCP tool, Workflow, Trigger.dev task, helper, test, or fixture, find out whether one already exists and build on it.

### Find what exists

Before writing an implementation, MUST:

1. Read this file, any `AGENTS.md` in a directory you will touch, and the sections of [the review guidelines](docs/maintainers/review-guidelines.md) whose "Applies to" paths cover your change.
2. Name the owner: the workspace (`src/` for the app, `web/` for the site), the feature (`src/server/features/<feature>/`, `src/client/features/<feature>/`), and the layer (route, server function, service, repository, MCP tool, Workflow, component, hook). [Where shared code lives](#where-shared-code-lives) lists the shared owners.
3. Search for the behavior, not only the name you would give it: domain terms, table and column names, Zod field names, `ErrorCode` values, query keys, and provider endpoints. Cover the feature's client and server directories, the shared owners below, and the existing tests and fixtures.
4. Read each candidate's source, callers, and tests. Use the code-review-graph MCP tools (`.mcp.json`) for callers, tests, and blast radius when your client has them and the graph has finished building; otherwise use `rg`. An empty graph result does not prove the code is absent.
5. Decide with the order below.

### Decide

Take the first option that works:

1. **Use** the existing implementation when its behavior and contract fit.
2. **Extend** it when the new behavior belongs to its owner and every existing caller keeps its behavior and invariants.
3. **Extract** to the shared owner when at least two real callers, in this change or already on `main`, need the same behavior and the shared API is simpler than the copies. Move the code; don't leave the old copy behind.
4. **Write new** when the candidate does not fit: it differs in authorization, tenant scope, billing or metering, error handling, side effects (writes, provider calls, events), or cost; or reusing it would make a module import a layer or workspace it must not depend on, or tie unrelated workflows together. Give the reason in one line in your handoff. No separate approval is needed.

Code that looks alike is not interchangeable until you have compared those properties.

- NEVER write a second implementation because the first was hard to find or needs a reasonable extension.
- NEVER copy a schema, query, enum, or business rule into a second place; import, extend, or extract it.
- NEVER add a helper, wrapper, base class, factory, or option for a single caller to make code look reusable.
- NEVER move a feature's code into a shared directory before a second feature uses it.

### Where shared code lives

- **UI primitives**: `src/client/components/ui/`. Add a missing primitive with the shadcn CLI; don't hand-roll a button, dialog, or select.
- **Shared UI patterns**: `src/client/components/` (`DataTable`, `QueryState`, `PageHeader`, `EmptyState`, `ConfirmDialog`, `SafeExternalLink`) and `src/client/components/form/` (`useAppForm`). A component only one feature uses stays in that feature's `components/`.
- **Client hooks and utilities**: `src/client/hooks/`, `src/client/lib/`.
- **Code used by more than one of the client, server, MCP, and `web/`**: `src/shared/`, holding Zod schemas, constants, and pure logic. NEVER import `@/db`, `@/server`, `@/serverFunctions`, or `@/client` there.
- **Business rules and provider, cache, and Workflow orchestration**: `src/server/features/<feature>/services/`. A server function and an MCP tool for the same capability call the same service.
- **Persistence**: `src/server/features/<feature>/repositories/`, using `db` from `@/db`, tables from `@/db/schema`, and `runBatch` from `@/db/runBatch` for multi-statement writes.
- **Sign-in and tenant context**: `requireProjectContext` and `requireAuthenticatedContext` (`src/serverFunctions/middleware.ts`), `withMcpProjectAuth` (`src/server/mcp/project-auth.ts`), and Every App identity (`src/middleware/ensure-user/everyApp.ts`).
- **Credits, spend limits, and paid providers**: `src/server/billing/` and `createDataforseoClient` (`src/server/lib/dataforseo/`). See [Billing fails closed](docs/maintainers/review-guidelines.md#billing-fails-closed) and [Spend limits](docs/maintainers/review-guidelines.md#spend-limits-and-the-spend-ledger-playbook-fork).
- **Errors**: `AppError` (`src/server/lib/errors.ts`) and `ErrorCode` (`src/shared/error-codes.ts`). Add a code to the existing list rather than a parallel error type.
- **Provider clients and server utilities**: `src/server/lib/`, including GSC, GA4, OpenRouter, R2, PostHog, scraping, and URL policy (`normalizeAndValidateStartUrl`, `isCrawlableUrl`).
- **Background work**: Cloudflare Workflows in `src/server/workflows/` (steps through `pgStep`, started with `startWorkflow` from `src/server/lib/startWorkflow.ts`) and Trigger.dev tasks in `trigger/`.
- **MCP tools**: `src/server/mcp/tools/`, with schemas in `src/server/mcp/schemas.ts` and `src/server/mcp/output-schemas.ts`, registered through `instrumentMcpToolHandler`.
- **Runtime config**: `src/server/lib/runtime-env.ts`, `everyapp.config.ts`, `wrangler.jsonc`, and `autumn.config.ts` for plan IDs.
- **Test helpers**: factories beside the tests they serve (`ga4-test-fixtures.ts`, `tool-test-support.ts`) and Playwright fixtures in `tests/fixtures/`.

### Boundaries

- `web/` is a separate workspace with its own dependency versions. It imports pure modules from `src/` by relative path; check the library major in `web/package.json` before reusing code that depends on one. NEVER import from `web/` in `src/`.
- Upstream OpenSEO owns the core: billing, providers, sign-in, audits, and MCP. To change core behavior for Relay, make the smallest edit to the upstream code and mark it `// playbook-seam`. NEVER fork a copy of a core module; the copy stops receiving upstream fixes.
- Before adding a dependency, check `package.json` for one that already does the job, such as Zod, Remeda, TanStack Query, Form, and Table, `tldts`, or `papaparse`. A new dependency gets a security read ([Review posture](docs/maintainers/review-guidelines.md#review-posture)).

### Changing shared code

- Before changing a function, schema, or component that other code uses, list its callers. Keep their behavior or update every caller in the same change.
- A schema change updates the SQLite and Postgres definitions and both migrations ([SQLite and Postgres parity](docs/maintainers/review-guidelines.md#sqlite-and-postgres-parity)). Cloudflare Workflow instances already running resume on the new code with their old params and step results, so keep those shapes parseable until the instances finish.
- Import an existing enum, Zod schema, route path, plan ID, credit cost, env name, or business rule instead of restating it. Never hand-edit the generated `src/routeTree.gen.ts`.
- Reuse the established sign-in, tenant-scoping, and input-validation paths. If a reused query lacks the scope your caller needs, add the scope to that query. NEVER fetch unscoped rows and filter them afterwards, and NEVER relax a check so a second caller fits.
- Keep money invariants when you reuse or extend a billing path: credits stay integers, paid provider calls go through the billing seams, retries and Workflow replays neither double-charge nor skip metering, and audit events are written in the same `runBatch` as the change ([Hard invariants](docs/maintainers/review-guidelines.md#hard-invariants)).
- Errors follow [Errors](#errors). A fallback that hides a broken path (an empty list, a default value, a skipped step) is a swallowed failure.

## TypeScript

The [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html) is the baseline. These rules and `.oxlintrc.json` override it where they differ, and Prettier owns formatting.

### Zod at runtime boundaries

- MUST define every runtime data shape as a Zod schema and derive its type with `z.infer<typeof schema>`.
- NEVER declare a `type` or `interface` that restates a Zod schema.
- MUST parse at the entry boundary: server function `.validator()`, API route bodies and params, MCP tool input, webhooks, Workflow and Trigger.dev payloads, Durable Object storage reads, forms, `JSON.parse` results, JSON columns, provider responses, structured AI output, and env strings you convert.
- MUST parse once at that boundary and pass the parsed type downstream; NEVER re-parse it unless it crosses a new trust boundary.
- MUST use `safeParse` where bad input is expected (users, webhooks, providers) and handle the failure; use `parse` only where invalid data is a bug that should throw.
- MUST encode real constraints: string formats (`uuid`, `email`, `url`), `.int()`, `.positive()`, `z.enum`, `z.discriminatedUnion`.
- MUST derive related schemas with `.extend()`, `.pick()`, `.omit()`, or `.partial()`; NEVER copy fields from one schema into another.
- MUST store new money amounts as integers (credits, or cents for currency); NEVER add a float money field. Provider-reported `costUsd` is the existing exception.

### Tenant and resource IDs

- MUST take `organizationId`, `projectId`, and `userId` from the verified context (`requireProjectContext`, session middleware), never from client input. See [Tenant and resource scoping](docs/maintainers/review-guidelines.md#tenant-and-resource-scoping).
- MUST name ID parameters for their kind (`projectId`, not `id`) and keep that name from server function to service to repository. The repo has no branded ID types.

### Assertions and escape hatches

`satisfies` and `as const` are compile-time checks: use them. `as T` and `!` are claims the compiler cannot verify: avoid them.

oxlint enforces the three NEVER rules below. A disable comment must give the invariant after `--` (see `src/db/runBatch.ts`).

- NEVER use `any`, `as any`, or `as unknown as T`.
- NEVER use `@ts-ignore`, `@ts-nocheck`, or `export let`.
- NEVER use a non-null assertion (`!`) unless an invariant the compiler cannot see guarantees the value; state it in the disable comment. Test files are exempt.
- MUST fix a type error by parsing, narrowing, handling `null`, or correcting the type; NEVER assert it away.
- MUST check a value against a type with `satisfies`. ✅ `{ ... } satisfies Record<Status, Handler>` ❌ `{ ... } as Record<Status, Handler>`
- MUST use `as const` for lookup tables and tuples whose literals must stay narrow.

### States and exhaustiveness

- MUST model mutually exclusive states as a discriminated union. ✅ `{ status: "error"; error: string }` ❌ `{ loading?: boolean; error?: string; data?: T }`
- MUST list every variant of a union in a `switch`; oxlint's `switch-exhaustiveness-check` fails the lint otherwise.
- NEVER add a `default` branch that silently absorbs union variants; name the cases that share a branch.

### Contracts, inference, and immutability

- MUST give exported service, repository, and billing or credit functions an explicit return type.
- MUST let inference type locals and private helpers; NEVER restate an obvious type (`const retries: number = 3`).
- MUST type array and object parameters the function does not mutate as `readonly` (`readonly Keyword[]`), and NEVER mutate data shared across modules.
- MUST keep `interface` for behavioral contracts (ports, providers, repositories); NEVER use one to recreate a Zod-derived data model.

### When a handwritten type is fine

Runtime data shape → Zod schema + inferred type. Compile-time behavior or abstraction → handwritten type when it helps.

- Function and callback types: `type Clock = () => Date`.
- Generic type parameters and reusable generic helpers.
- Mapped, conditional, and indexed types (`CreateProjectInput["name"]`).
- Behavioral interfaces for ports, providers, repositories, and other service contracts.

Internal data is not exempt. Derive its type from what produces it (the schema, the Drizzle table's `$inferSelect`, or the function's inferred return), not from a handwritten copy of its fields.

### Errors

- MUST throw `AppError` with an `ErrorCode` (`src/server/lib/errors.ts`) for expected failures, or an `Error` subclass in a leaf module (`src/server/lib/gscErrors.ts`) when callers branch on the type.
- NEVER throw a non-`Error` value; TanStack Router's `notFound()` and `redirect()` are the only exceptions oxlint allows.
- MUST treat caught values as `unknown` and narrow them (`instanceof`, `asAppError`) before reading fields.
- NEVER swallow failures (`catch { return null }`); a catch may return a fallback only for the one expected failure it handles.
- MUST keep the caught error as `cause` when translating it (`new Error(message, { cause: error })`), and log it with `describeError`.

### Naming

- MUST use `UpperCamelCase` for types, interfaces, and classes, and `lowerCamelCase` for values, functions, parameters, and Zod schemas (`createProjectSchema` → `CreateProjectInput`).
- MUST use `CONSTANT_CASE` for module-level constant values (`AUTUMN_SEO_DATA_CREDITS_PER_USD`).
- MUST write abbreviations as words: `projectId` and `apiUrl`, not `projectID` and `APIURL`.
- NEVER prefix interfaces with `I`.

## Every App

OpenSEO also runs behind an Every App Gateway (`AUTH_MODE=everyapp`; how it works is in `docs/maintainers/every-app.md`).

- Before running everyapp, read the everyapp skill. It lives in the platform checkout beside this repository, `../private-every-app/packages/cli/skills/everyapp/SKILL.md`; `everyapp create` copies it into new apps, and this port reads it from there.
- Run the app with `pnpm dev:everyapp` (everyapp dev): both Workers behind a local gateway with a seeded dev user. The keys it needs locally go in `.dev.vars`, written by hand.
- Deploy only through the Every App CLI: `pnpm everyapp install https://github.com/every-app/open-seo` from an Every App checkout (the npm CLI installed here cannot deploy). Never run `cf deploy` or `wrangler deploy` for this mode. `deploy:selfhost` is the other self-hosting path (`pnpm deploy` is the plain `wrangler deploy` of `wrangler.jsonc`) and `deploy:postgres` is app.openseo.so's production deploy; none of them is this one.
- Declare resources (D1, KV, Durable Objects, Workflows, the audit Worker) and settings (`providers`, `capabilities`, `secrets`, each with its need and `why`) in `everyapp.config.ts`; `cloudflare.config.ts` builds the Workers from it.
- The Gateway signs people in: read identity only through the SDK (`src/middleware/ensure-user/everyApp.ts`), never from a client-supplied header or cookie, and treat every route listed under `public` in `everyapp.config.ts` as open to the internet.

## Testing

- Don't add tests just for the sake of it. A test exists to enforce core behavior or a hard-to-spot edge case that could actually occur.
- A change to authentication or authorization, billing or metering, persistence or queries, schema or migrations, provider serialization, Workflow retries or state transitions, or URL handling MUST include a focused behavioral test unless an existing test already covers the changed branch. A bug fix's test must fail on the old code. See [Behavioral evidence for risky changes](docs/maintainers/review-guidelines.md#behavioral-evidence-for-risky-changes).
- Extend the existing test file, table-driven case, or fixture factory for the same behavior before adding a new one. The `test-audit` skill (`.agents/skills/test-audit/SKILL.md`) is the procedure for writing and reviewing tests.
- Keep tests as simple as possible, and always review them looking for simplifications.
- Test behavior at the public entry point. Assert argument forwarding to a mocked collaborator only when that mapping is the contract (billing params, telemetry events).
- Statically import the module under test. `vi.mock` is hoisted, so per-test `await import()` and `vi.resetModules()` are banned unless module-level state must reset — comment why.
- Never re-declare a production class in a test. Import the real one; if the module is too heavy to import, move the class to a leaf module first (see `ga4Errors.ts`, `gscErrors.ts`).
- `beforeEach` sets default mock return values only. Vitest's `clearMocks` already resets call state — no `mockReset`/`mockClear` ceremonies.
- Fixtures contain only the fields the test asserts on or the types require. Shared shapes get a factory with overrides (see `ga4-test-fixtures.ts`, `tool-test-support.ts`); a fixture longer than its test's assertions is a smell.
- One test per invariant. Don't re-test Zod or a library, and don't repeat an output-schema round-trip in every happy path.
- Don't mock ORM builder chains. Test repositories through services or real SQL evaluation; chain mocks break on refactors that change no behavior.
- Don't export a function only so a test can reach it. Test through the public entry point (the service object, tool handler, or workflow); Knip fails CI on the orphaned export.
- Vitest's `clearMocks` clears call history only. A `mockResolvedValue` or `mockImplementation` set inside a test survives into the next one, so every persistent default belongs in `beforeEach`.
- A negative test must fail for the reason its name gives. If a different guard rejects first (hosted mode off, missing auth, an earlier validation), the test proves nothing about the behavior it names.

## Checks and handoff

- Before handing off a code change, MUST run `pnpm ci:check` and `pnpm test` and get both passing; `merge-ready` runs the same pair. CI (`.github/workflows/ci.yml`) also builds the Worker, the standalone server, and `web/`. When you touch those, run the matching CI step.
- For a Markdown-only change, run `pnpm exec prettier --check` on the changed files and confirm every link and path in them resolves.
- NEVER get a change through by disabling, skipping, or loosening a check: a lint rule, a Knip ignore, a test, or a CI step. Fix the cause. The one lint exception is a disable comment that states its invariant ([Assertions and escape hatches](#assertions-and-escape-hatches)).
- End implementation work with a short report to the person who asked. Scale it to the change: a one-line fix needs one or two lines.
  - **Reused**: the existing code or patterns you used or extended.
  - **New despite a candidate**: anything you added where something similar existed, and why that candidate did not fit.
  - **Affected**: shared code you changed and the callers or features that depend on it.
  - **Checks**: what you ran and the result, and anything that failed or that you could not run, with the reason.
- That report belongs in your reply, not the PR description, which keeps the `simple-issue-description` format ([Documentation audience](#documentation-audience)). Put reuse decisions the maintainer should weigh under its Extra context.

## Plugin versions

- Bump the OpenSEO plugin version when a PR adds a new MCP tool, adds a new shipped skill, or substantially changes a shipped skill's workflow or instructions. Substantial skill changes include changing its required steps, tool choices, or expected output.
- Routine fixes, refactors, and changes to existing tools' implementation, behavior, schemas, or descriptions do not require a bump. Neither do minor skill edits, internal-only skills, tests, website or app changes, or routine plugin configuration edits. Use judgment for other major plugin changes; do not bump merely because a plugin-related file changed.
- The plugin points at the hosted MCP server, so server changes reach users on deploy without a plugin version bump. When a fix applies to both the app and an MCP tool, ship it to both.
- When a bump is warranted, keep `plugins/openseo/.codex-plugin/plugin.json`, `plugins/openseo/.claude-plugin/plugin.json`, and `plugins/openseo/.cursor-plugin/plugin.json` on the same version. Default to a patch bump unless the maintainer requests a minor or major bump.
- Bump once per PR relative to `origin/main`, not once per edit or tool. For a PR that requires a bump, if main advances the plugin version before merge, update the branch to a version newer than main. Otherwise, keep main's version. The app's `package.json` version follows its separate release process.
- Run `pnpm sync-plugin-skills` after changing a shipped skill and include the updated plugin copy, even when no version bump is needed. Call out plugin version and instruction changes for maintainer review.

## Documentation audience

- `docs/` (except `docs/maintainers/`) and `web/content/docs/` are public, user-facing documentation. Write only material that helps users understand, use, or self-host the product.
- Do not put internal working notes, content briefs, drafts, asset-sourcing notes, implementation logs, or agent handoffs in those directories.
- Use `docs/maintainers/` for engineering decisions, development workflows, and maintenance notes that should be shared and versioned. This directory is tracked in Git but is not part of the user-facing documentation site. Create notes only when requested or useful for future maintenance; never include secrets.
- Write PR descriptions in the `simple-issue-description` format, with no validation logs or per-file changelog. Continue using the dedicated papercut log for repository friction.

## Log papercuts

When small, non-blocking repository friction occurs—a retried tool call, confusing setup step, flaky command, stale cache, misleading error, or non-obvious gotcha—use the `papercuts` skill and append it to `.agents/PAPERCUTS.md` in the moment. Continue the current task. Real bugs and tracked work are not papercuts, and sensitive data must never be logged.

Do not mine an entire session for papercuts or start a broad cleanup unless the user explicitly asks.

## Preserve review learnings

Reviewer context lives in `docs/maintainers/review-guidelines.md`: the hard invariants (tenant scoping, dual-dialect persistence, billing seams, SSRF handling) and the false-positive controls that keep reviewers from flagging intentional behavior. After a merge-ready or other code review verifies a finding, add to that file only when the finding exposes a recurring or high-risk repository invariant that existing context and automated checks do not capture. Do not promote one-off bugs or preferences into permanent review rules.

Changes to `AGENTS.md`, `.claude/CLAUDE.md`, `.agents/skills/**`, `.github/**`, and `docs/maintainers/review-guidelines.md` alter the review control plane and must receive explicit maintainer review. CODEOWNERS requests that review; where repository settings allow, enable GitHub's requirement for code-owner approval.

## Playbook fork: upstream sync

This repository is the Playbook Media fork of `every-app/open-seo`, sold as Relay. We stay a downstream fork and take upstream's core improvements.

- `.github/workflows/upstream-sync-playbook.yml` merges upstream `main` into a `sync/upstream-<date>` branch on the 1st and 15th of each month, runs the CI checks, and opens a pull request. A person reviews and merges it. Merging deploys production.
- Time-box each sync to 2 hours. Record the time spent and the conflicted files in the pull request.
- On conflicts, keep upstream's core code (billing, providers, sign-in, audits, MCP) and keep our user interface.
- Keep every `// playbook-seam` line. The seam registry is in `vite-plugin-relay-brand.ts`.

Hard-fork when any of these happens:

- Two merges in a row take more than a day.
- Upstream changes billing, sign-in or the data model in a way that breaks our product.
- The retention engine needs core rewrites that upstream would not accept.

If we do hard-fork:

- Keep the MIT license and attribution.
- Rename the code properly and remove the build-time "OpenSEO → Relay" rewrite.
- Delete features we don't sell.
- Keep watching upstream for security fixes to cherry-pick.
