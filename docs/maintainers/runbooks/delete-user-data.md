# Delete a user's data (Relay, D1)

Use this runbook when a Relay user asks for their data to be deleted. Relay runs on D1. The upstream command in `gdpr-erasure.md` works on Postgres only, so Relay uses `scripts/relay-erase-user-d1.ts`. It follows the same rules and calls the same Worker storage endpoint.

## What the command deletes

1. **Autumn:** the customer record of each of the user's organizations, and the linked Stripe customer.
2. **Worker storage** (through `/api/internal/gdpr-erasure/storage`): it revokes the user's Google grants (Search Console and GA4), stops running audit, rank-check and AI-visibility workflows, and deletes chat sessions, audit scratchpads, R2 audit payloads, KV progress entries and MCP OAuth grants.
3. **GitHub:** it decrypts each stored personal access token in the user's projects and submits it to GitHub's credential revocation API. GitHub App connections store no token.
4. **D1:** it deletes the user's organizations and the user. Foreign-key cascades remove the projects and everything in them: opportunities, proposals, executions, experiments, audits, keywords, reports and connections. It also deletes invitations to the user's email, verification rows (including GitHub App install states), Search Console and GA4 connections and API keys.
5. **Attribution:** columns that name a user but have no foreign key (for example `opportunity_decisions.actor_user_id`, `proposal_approvals.actor_user_id`, `reports.created_by_user_id`) are set to `gdpr-deleted-user`. A report that the user created loses its public share link.

The command refuses a user who belongs to an organization with other members. Remove the user from that organization first, then run it again. A deleted organization takes its data with it, so never delete a shared organization this way.

## One-time setup

1. Generate a secret: `openssl rand -base64 48`.
2. Add `GDPR_ERASURE_SECRET=<secret>` to `ENV_PLAYBOOK`, then deploy. Until then, the storage endpoint returns 404 and the command stops at step 2.
3. Check that the R2 bucket `open-seo-r2-playbook` has a lifecycle rule that expires `dataforseo-cache/`. Older prompt-cache objects cannot be linked to a user, so they must expire. On 2026-10-16, `pnpm exec wrangler r2 bucket lifecycle list open-seo-r2-playbook` showed the rule `dataforseo-cache-expiry`, which expires them after 7 days.

## Operator environment

Put these values in an untracked file, for example `.env.local` in the repository root. The command reads `.env.local` and `.env`.

```dotenv
CLOUDFLARE_ACCOUNT_ID=de345701e5dc7e14d3c079da3e637448
BETTER_AUTH_URL=https://relay.playbookmedia.io
BETTER_AUTH_SECRET=...      # same value as production, to decrypt stored GitHub tokens
# If production sets PUBLISHING_TOKEN_KEY, copy it, PUBLISHING_TOKEN_KEY_VERSION
# and PUBLISHING_TOKEN_KEY_PREVIOUS too. A token no key opens is skipped with a
# warning and is not revoked; the erasure still completes.
GDPR_ERASURE_SECRET=...     # same value as production
AUTUMN_SECRET_KEY=am_sk_live_...
```

Run `pnpm exec wrangler login` first. The command uses wrangler for D1.

## Run

1. Inventory the user. This changes nothing:

   ```bash
   pnpm exec tsx scripts/relay-erase-user-d1.ts --database open-seo-db-playbook --email person@example.com
   ```

2. Check the printed user id, email and counts.
3. Execute with the exact email from the inventory:

   ```bash
   pnpm exec tsx scripts/relay-erase-user-d1.ts --database open-seo-db-playbook \
     --email person@example.com --execute --confirm person@example.com
   ```

4. The command ends with `Verified:` and zero counts for the user, organizations, members, sessions, accounts and API keys. Save the output as the deletion receipt.
5. Delete the person in PostHog (Persons, search by user id, Delete person and events). The command does not do this.
6. If the user installed the Relay GitHub App on their own account or organization, ask them to uninstall it in their GitHub settings. Relay cannot uninstall it for them.
7. Ask the user to check that Relay no longer appears at https://myaccount.google.com/connections.

If a step fails, fix the cause and run the same command again. Every step can run twice safely.

## Test on a copy

Do this before the first production use, and after a schema change that adds a table with user data.

1. Export production: `pnpm exec wrangler d1 export open-seo-db-playbook --remote --output prod.sql`.
2. Load it into local SQLite: `grep -v '^PRAGMA defer_foreign_keys' prod.sql | sqlite3 copy.db`.
3. Create a test database: `pnpm exec wrangler d1 create open-seo-db-erasure-test`.
4. Import the schema (`sqlite3 copy.db .schema`), then the rows with parent tables first. A plain `.dump` fails on D1, because D1 imports in chunks and checks foreign keys in each chunk.
5. Run the command with `--database open-seo-db-erasure-test --execute --confirm <email> --database-only`. `--database-only` skips Autumn, the Worker endpoint and GitHub, because those act on production services.
6. Export the test database and search it for the user id and email. Expect no match.
7. Delete the test database and every local copy. They hold user data.

**Last test, 2026-10-16:** before the deletion, 47 lines of the export named the user id. After it, no line named the user id or the email. The user's organization, 4 projects, 6 opportunities, 3 audits, accounts, sessions, publishing connections and experiments were gone. An organization that had no members kept its project.

## Retention

The command output is the deletion receipt. Do not send it to product analytics. PostHog deletes events in the background. Workers logs and completed workflow state expire under the Cloudflare account's retention. D1 Time Travel keeps earlier states for 30 days (see `restore-d1.md`), and so the deleted rows are gone from every restore point after 30 days.
