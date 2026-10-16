# Restore the D1 database (Relay)

Use this runbook to recover `open-seo-db-playbook` after bad data, a failed migration or an accidental delete. D1 Time Travel restores a database to any minute in its history.

## What to know first

- **History:** Workers Paid keeps 30 days. A restore cannot go back before the database was created. `open-seo-db-playbook` was created on 2026-10-14 at 18:16 UTC.
- **In place:** a restore replaces the whole database. Every write after the restore point is lost, for every user. Restore only the minimum period.
- **Undo:** each restore prints the bookmark of the state before it. Restore to that bookmark to undo.
- **Schema:** the restored database has the schema of that time. If the deployed code needs a newer migration, redeploy the matching commit, or let the next deploy apply the migrations again.

Set the account before each command:

```bash
export CLOUDFLARE_ACCOUNT_ID=de345701e5dc7e14d3c079da3e637448
```

## Before a risky change

Record the current bookmark. You can restore to it exactly:

```bash
pnpm exec wrangler d1 time-travel info open-seo-db-playbook
```

## Restore

1. Find the last good time. Use the deploy history, the Workers logs and user reports.
2. Get its bookmark. This reads only:

   ```bash
   pnpm exec wrangler d1 time-travel info open-seo-db-playbook --timestamp 2026-10-16T11:45:00Z
   ```

3. Pause the deploy workflow, so no migration runs during the restore.
4. Restore. Save the "previous bookmark" that the command prints:

   ```bash
   pnpm exec wrangler d1 time-travel restore open-seo-db-playbook --bookmark=<bookmark>
   ```

5. Check the row counts of the main tables against what you expect:

   ```bash
   pnpm exec wrangler d1 execute open-seo-db-playbook --remote --command \
     "SELECT (SELECT count(*) FROM user) users, (SELECT count(*) FROM organization) orgs, (SELECT count(*) FROM projects) projects"
   ```

6. Run the deploy workflow once, so the migrations and the smoke test run.
7. Tell affected users which period of changes was lost.

## Test

Never test a restore on `open-seo-db-playbook`. Use a copy, as in the "Test on a copy" steps of `delete-user-data.md`, then:

1. Record the copy's bookmark and row counts.
2. Change data, for example by running the erasure command on it.
3. Restore the copy to the recorded bookmark.
4. Compare the row counts. They must match step 1.
5. Delete the copy.

**Last test, 2026-10-16:** a copy of production had 1 user, 2 organizations, 5 projects, 6 opportunities, 3 audits and 7 proposals. After an erasure it had 0, 1, 1, 0, 0 and 0. After a restore to the recorded bookmark, it had 1, 2, 5, 6, 3 and 7 again, the same as the source. A read-only timestamp lookup on production returned a bookmark for 2 hours before.

`time-travel info --timestamp` failed with an internal error on a database that was a few minutes old. Use the bookmark from `time-travel info` (no timestamp) in that case.
