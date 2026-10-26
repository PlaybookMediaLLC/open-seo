# Disposable local runtime used for the assessment

The assessment used the actual repository in hosted mode with an empty, separately
migrated D1 database. No existing ignored environment file or provider credential
was copied. This recipe is for local passive checks, not deployment.

1. Create a private temporary directory outside the repository. Copy only files
   listed by `git ls-files -z`, reading each file from the working tree so current
   fixes are included. Exclude any operator-added credential files even if they
   were mistakenly tracked. Copy `node_modules` into that directory with
   `cp -a --reflink=auto`; a symlink outside the directory fails Vite's file scope.
   Do not copy `.env*`, `.dev.vars*`, `.wrangler`, or existing databases. The tracked
   environment examples are documentation only and are not needed.
2. Create `.env` and `.dev.vars` in the temporary directory with the same settings:
   `AUTH_MODE=hosted`, `BETTER_AUTH_URL=http://localhost:3217`, `PORT=3217`,
   `OPENSEO_TELEMETRY_DISABLED=true`, `DO_NOT_TRACK=true`,
   `VITE_SHOW_DEVTOOLS=false`. Supply unmistakably fake local placeholder values
   for `BETTER_AUTH_SECRET` (at least 32 characters), `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `LOOPS_API_KEY`,
   `LOOPS_TRANSACTIONAL_VERIFY_EMAIL_ID`,
   `LOOPS_TRANSACTIONAL_RESET_PASSWORD_ID`, `TURNSTILE_SITE_KEY`, and
   `TURNSTILE_SECRET_KEY`. These satisfy configuration checks only. Do not set a
   real provider key or disable authentication/captcha to make checks pass.
   Ensure inherited shell variables do not override these with real credentials.
3. In that temporary directory run `pnpm exec fumadocs-mdx` if generated docs data
   is missing, followed by `pnpm exec wrangler d1 migrations apply DB --local`.
   The configured D1 identifiers name local files here; never add `--remote`.
4. Start `pnpm exec vite dev --host 127.0.0.1 --port 3217`. Initial compilation can
   take a minute. Check that both `/api/health` and `/api/auth/get-session` return
   HTTP 200. The hosted base URL must use the literal `localhost` host for HTTP,
   even though scanners can connect through `127.0.0.1`. Missing Google or email
   placeholders cause hosted auth configuration to fail closed with HTTP 500.
5. From the original repository, run the DAST command in `security/README.md` with
   `SECURITY_DAST_TARGET=http://127.0.0.1:3217` and
   `SECURITY_DAST_AUTHORIZED=yes`. Do not use the UI to log in, start audits, send
   email, create jobs, or invoke external integrations with these placeholders.
6. Stop only the temporary server's process, preserve the sanitized reports, and
   delete the disposable copy. Do not delete or migrate the original workspace's
   database or modify production credentials.

The assessment performed only the fixed GET paths in `runtime-paths.json` with no
browser, no sign-in, and no paid provider requests. A production build or staging
scan is still required to establish deployed response-header behavior.
