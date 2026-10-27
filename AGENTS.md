# Agent guidance

## Engineering principles

- Prefer simple, readable, flat code with minimal indirection.
- Work on bugs a real user hit or would plausibly hit. Don't open a ticket or PR for an edge case found only by reading the code; flag it instead. Security holes and significant billing abuse are the exception.
- Search for existing implementations and installed libraries before creating new helpers or abstractions.
- Abstract when it prevents meaningful drift and makes the result simpler to maintain. Avoid speculative or one-use abstraction layers.
- Keep product data normalized and relationships explicit. Do not encode relational data in JSON or text merely to avoid joins.
- For new application-backed backend functionality, default to: TanStack server function → service → repository.
- Keep schema changes, queries, and mutations compatible with both SQLite and Postgres.
- Prefer established project helpers and libraries over hand-rolled implementations.
- Prefer idiomatic TanStack Query, Router, and Form patterns for server state, routing, and submitted forms.
- shadcn components in `src/client/components/ui/` are built on Base UI, not Radix. Compose them with the `render` prop, not `asChild`.
- Specs under `docs/maintainers/specs/` are public design records: what a feature does, how it works, the alternatives considered and why they lost. No line numbers, migration mechanics, test plans, incidents, costs, or internal infrastructure details.

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
