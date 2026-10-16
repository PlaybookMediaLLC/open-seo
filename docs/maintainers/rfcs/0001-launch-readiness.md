# RFC-0001: Launch readiness for other users

- **Status:** Draft
- **Date:** 2026-10-15
- **Scope:** relay.playbookmedia.io (`AUTH_MODE=hosted`, D1, Google-only sign-in)
- **Depends on:** nothing. All other RFCs depend on this one.

## 1. Summary

Relay is public, but a new user cannot yet complete the main workflow reliably. Some blockers are configuration, some are Google review steps, and one is a live test that nobody has run. This RFC lists each blocker, the evidence for it, and the exact steps to close it.

"Ready for other users" means this: a stranger signs in with Google, connects Search Console, gets opportunities, prepares a change, opens a pull request, and later sees a measured result. Each step works without help from us. Each failure shows a clear message.

## 2. Current state (verified on 2026-10-15)

| Area                      | State                                                                               | Evidence                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Sign-in                   | Works. Google-only.                                                                 | `AUTH_GOOGLE_ONLY=true` in the deploy config.                                                                                              |
| Google OAuth branding     | Under human review, submitted 2026-10-15.                                           | Verification Center shows "Your branding is currently under review."                                                                       |
| Google OAuth data access  | No scopes declared on the Data Access page.                                         | Data Access page lists no rows.                                                                                                            |
| Search Console scope      | `webmasters.readonly`. Google lists it as non-sensitive.                            | Data Access "Add scopes" panel.                                                                                                            |
| Analytics scope           | `analytics.readonly`. Sensitive. Needs a justification and a demo video.            | Same panel. The justification text is drafted. The video does not exist yet.                                                               |
| AI provider key           | `OPENROUTER_API_KEY` is empty in the local copy of `.env.playbook`.                 | Key count check, no value read. Verify the deployed secret.                                                                                |
| Team invitation email     | Not configured. `LOOPS_API_KEY` and `LOOPS_TRANSACTIONAL_INVITATION_ID` are absent. | `src/server/email/loops.ts`, `sendHostedInvitationEmail` requires both.                                                                    |
| Billing (Autumn)          | `AUTUMN_SECRET_KEY` and `AUTUMN_WEBHOOK_SECRET` are set. Plans not verified.        | Key presence check. `docs/maintainers/playbook-deployment.md` still says Autumn is unconfigured.                                           |
| Error monitoring          | Off. `POSTHOG_PUBLIC_KEY` is empty.                                                 | Key count check.                                                                                                                           |
| Uptime                    | On. Smoke test after deploy and a check every 15 minutes.                           | `.github/workflows/deploy-playbook.yml`, `uptime-playbook.yml`.                                                                            |
| Growth workflow live test | Never run with real credentials.                                                    | `docs/maintainers/organic-growth-handoff.md`, section 7F.                                                                                  |
| In-app docs               | No pages for Opportunities, Experiments or GitHub publishing.                       | `content/docs/` lists no such pages. Repository docs exist in `docs/OPPORTUNITIES.md`, `docs/EXPERIMENTS.md`, `docs/GITHUB_PUBLISHING.md`. |
| Account deletion          | No self-serve deletion. The privacy policy offers deletion by email.                | No delete-account code path found.                                                                                                         |
| End-to-end test           | None for the growth workflow.                                                       | `tests/*.spec.ts` covers domain overview and keyword research only.                                                                        |

## 3. Blockers

Fix every blocker before you invite users outside the team.

### B1. Google OAuth verification

**Problem:** Until Google verifies the app, users who connect Google Analytics see an "unverified app" screen. Google also limits unverified apps with sensitive scopes to 100 users.

**Steps:**

1. Wait for the branding review result (2 to 3 business days).
2. If Google rejects it, read each reason. Fix the page, or reply in the review thread.
3. Record a demo video in English, in one take. Show the home page, Google sign-in, the GA4 connect consent screen with the `client_id` in the address bar, the GA4 data on the dashboard, and the disconnect control. Upload it to YouTube as "Unlisted".
4. Open Data Access. Add `openid`, `userinfo.email`, `userinfo.profile`, `webmasters.readonly` and `analytics.readonly`.
5. Paste the `analytics.readonly` justification. Paste the video link. Click Save.
6. Open Verification Center. Submit the data access verification.
7. Answer Google's email questions within their deadline.

**Done when:** Verification Center shows both branding and data access as verified. A new Google account connects GA4 without the warning screen.

### B2. AI provider key

**Problem:** The AI assistant and the planned proposal drafting (RFC-0004) need `OPENROUTER_API_KEY`. The local deploy config has an empty value.

**Steps:**

1. Create an OpenRouter key for Relay production only.
2. Set a monthly spend limit on the key in the OpenRouter dashboard.
3. Put the key in `ENV_PLAYBOOK`. Redeploy.
4. Open the AI assistant as a free-plan user. Ask one question. Confirm that the credit balance goes down.

**Done when:** The assistant answers in production, and Autumn records the charge.

### B3. Team invitation email

**Problem:** Inviting a teammate calls `sendHostedInvitationEmail`. Upstream sends it through Loops, and it throws when the Loops keys are missing, so invitations fail.

**Decision:** Transactional email (invites) goes through Cloudflare Email Sending. It is part of Workers Paid, with 3,000 emails a month included. Loops holds the customer list for product updates and mass email.

**Steps:**

1. `src/server/email/relay-email.ts` sends the invite through the `EMAIL` binding, from `invites@mail.playbookmedia.io`. The deploy binds `EMAIL` (`deploy/alchemy/alchemy.run.ts`). Without the binding, the upstream Loops path runs.
2. In Cloudflare Email Service, onboard `mail.playbookmedia.io` as a sending domain. Cloudflare adds the SPF, DKIM and return-path records.
3. Send a test invitation to a second Google account.

**Done when:** An invitation reaches a second account and passes SPF and DKIM.

### B4. Billing plans

**Problem:** The landing page shows plans and credits. Nobody has checked that Autumn's products match them, or that the webhook reaches production.

**Steps:**

1. In Autumn, list the products. Compare names, prices and credit amounts with the pricing section on `/`.
2. Set the Autumn webhook URL to the production endpoint. Confirm that `AUTUMN_WEBHOOK_SECRET` matches.
3. In Autumn test mode, buy the smallest plan and one top-up with a test card.
4. Confirm that the Billing page shows the new plan and balance.
5. Run one paid keyword lookup. Confirm that the balance goes down by the shown cost.
6. Update `docs/maintainers/playbook-deployment.md`. Remove the line that says Autumn is unconfigured.

**Done when:** A test purchase changes the plan and balance, and a paid lookup settles the correct amount.

### B5. Live acceptance of the growth workflow

**Problem:** Milestones 1 to 3 pass with mocked providers only. Nobody has run them against a real Search Console property and a real repository.

**Blocked by:** RFC-0005 phase 1a. Every page on test site S1 uses a route group and a metadata helper call. The current parser rejects both, so it cannot prepare any change on S1.

**Steps:**

1. Use test site S1 (`playbookmedia.io`). Confirm its Search Console property in the Relay project. Record its 28-day totals.
2. Use the repository `PlaybookMediaLLC/monorepo` with root directory `apps/www` and base branch `main`.
3. Run opportunity detection. Record the count and three sample opportunities.
4. Review and approve one striking-distance opportunity.
5. Create a fine-grained token for that one repository, with Contents and Pull requests write access.
6. Connect the repository. Prepare a description proposal. Check the diff.
7. Approve the exact change. Confirm that one pull request opens with one changed file.
8. Merge the pull request. Deploy it. Confirm the new description on the live page.
9. Start result tracking. Refresh the pull request status. Confirm the deployment.
10. Request one measurement. Confirm that the baseline is saved.
11. After about 38 days, request the final measurement. Record the label and the caveats.
12. Write the results in `docs/maintainers/organic-growth-audit.md` under a new "Live acceptance" heading.

**Done when:** Steps 1 to 10 pass, with evidence. Step 11 can finish after launch.

### B6. Error monitoring

**Problem:** Production has no error reporting. A failing server function is invisible unless a user writes to us.

**Steps (choose one):**

1. **PostHog:** set `POSTHOG_PUBLIC_KEY`, `POSTHOG_HOST` and the `POSTHOG_CLI_TOKEN` secret. Turn the source-map workflow on again.
2. **Or Cloudflare only:** turn on Workers Logs for the worker. Add a saved query for `level=error`. Check it daily.

**Done when:** A test error from production appears in the chosen tool within five minutes.

### B7. In-app documentation

**Problem:** Users read help at `/docs`. It has no pages for the growth features.

**Steps:**

1. Port `docs/OPPORTUNITIES.md`, `docs/EXPERIMENTS.md` and `docs/GITHUB_PUBLISHING.md` into `content/docs/` as MDX pages.
2. Add them to `content/docs/meta.json`.
3. Add the token-permission instructions and screenshots to the GitHub page.
4. Link each feature page's empty state to its doc page.

**Done when:** `/docs` has the three pages, and the empty states link to them.

## 4. Should fix before paid plans open

These do not block a free beta. Fix them before you charge money.

### S1. Billing accuracy debts

The platform audit lists three verified debts. RFC-0009 fixes them.

1. A DataForSEO payload that fails validation can release a hold without recording the provider charge (`src/server/lib/dataforseo/envelope.ts`, `parseTaskItems`).
2. A settlement that fails after its retry is only logged (`src/server/billing/subscription.ts`, `settleUsageCredits`).
3. AI prompt suggestions check the balance without a hold, so parallel requests can overdraw (`src/server/features/ai-visibility/services/aiPromptSuggestions.ts`).

### S2. Data deletion runbook

1. List every table that holds user or project data, for D1.
2. Write the deletion steps for one user and for one organization.
3. Revoke stored Google tokens and GitHub tokens as part of deletion.
4. Test the steps on a copy of the database.
5. Save the runbook as `docs/maintainers/runbooks/delete-user-data.md`.

### S3. Backup and restore runbook

1. Confirm that D1 Time Travel is available on the account plan.
2. Restore a copy of `open-seo-db-playbook` to a past point in a test database.
3. Write the steps in `docs/maintainers/runbooks/restore-d1.md`.

### S4. End-to-end test of the growth workflow

1. Add a Playwright spec that runs in `AUTH_MODE=local_noauth`.
2. Mock Search Console and GitHub at the provider client boundary.
3. Cover: detect, review, approve, prepare, approve the change, see the pull request link, start tracking.
4. Run it in CI.

### S5. Support readiness

1. Confirm that someone reads `team@playbookmedia.io` every business day.
2. Write saved replies for: Google connection problems, GitHub token setup, credit questions and data deletion.

## 5. Risks that stay open at launch

State these in the docs or the terms. Do not hide them.

1. Static validation of a metadata change is not a build of the customer's application.
2. Deployment is a human statement until RFC-0005 adds deployment signals.
3. A before-and-after result is not proof that the change caused it.
4. The URL policy in `src/server/lib/audit/url-policy.ts` does not pin DNS answers. On Cloudflare Workers, the edge network limits the risk. Self-hosted Docker installs need their own egress controls.

## 6. Ready-for-other-users checklist

### Google

- [ ] Branding review approved.
- [ ] Data Access lists all five scopes.
- [ ] Demo video uploaded and linked.
- [ ] Data access verification approved.
- [ ] A new account connects GA4 without the unverified-app screen.

### Configuration

- [ ] `OPENROUTER_API_KEY` set, with a provider spend limit.
- [ ] The assistant answers in production, and the charge settles.
- [ ] Sending domain onboarded, and a test invitation delivered.
- [ ] Autumn products match the landing page pricing.
- [ ] Autumn webhook reaches production.
- [ ] A test purchase and a test top-up work.
- [ ] Error monitoring receives a test error.
- [ ] `docs/maintainers/playbook-deployment.md` matches the real configuration.

### Workflow

- [ ] Live acceptance steps 1 to 10 pass on a real property and a real repository.
- [ ] The evidence is written in `docs/maintainers/organic-growth-audit.md`.
- [ ] RFC-0004 phase 1 is done, so the system drafts the change.
- [ ] The Playwright growth-workflow spec runs in CI.

### Documentation and support

- [ ] `/docs` has Opportunities, Experiments and GitHub publishing pages.
- [ ] Empty states link to those pages.
- [ ] The data deletion runbook exists and was tested on a copy.
- [ ] The D1 restore runbook exists and was tested.
- [ ] The support mailbox has an owner and saved replies.

### Before paid plans

- [ ] RFC-0009 billing debts fixed.
- [ ] Project and organization spending limits work.

## 7. Real-site acceptance test

**Sites:** S3 (`relay.playbookmedia.io`) for sign-up, with S1 (`playbookmedia.io`) as the project.

**Steps:**

1. Use a Google account that is not a team member and has never used Relay.
2. Sign in on `relay.playbookmedia.io`. Create a project for `playbookmedia.io`.
3. Connect Search Console and GA4 for `playbookmedia.io`.
4. Run opportunity detection. Open one opportunity.
5. Ask the assistant: "What should I fix first on this site, and why?"
6. Invite a second Google account. Accept the invitation.
7. In Autumn test mode, buy one top-up. Run one paid keyword lookup.
8. Trigger a test error in production.

**Pass when:**

- No step shows Google's unverified-app screen.
- Steps 2 to 4 take under 10 minutes with no help from the team.
- Step 4 shows a ranked list with evidence, or the plain "not enough data" message. Never an empty page or an error.
- The assistant's answer names real pages from the project and cites their numbers. The credit balance drops by the settled cost.
- The invitation arrives, and the second account sees the project.
- The test error appears in monitoring within 5 minutes.
- Live acceptance B5 steps 1 to 10 pass on S1.

**Value check:** a stranger reaches a ranked, evidence-backed list of fixes for a real site in the first session.

## 8. Completion criteria

**New-user flow**

- Three people outside the team each complete sign-in, project creation, Search Console connection and the first opportunity list without help. Each takes under 10 minutes. Record each time.
- Three kinds of Google account (personal Gmail, Google Workspace, an account created that day) connect Search Console and GA4 with no unverified-app screen.
- A new user finds the Search Console setup help from inside the app in 2 clicks or fewer.

**Google verification**

- Branding and data access both show "verified" in the Verification Center.
- The consent screen shows the name "Relay" and the R logo.

**AI assistant**

- Ten questions across two real projects all get answers. Each answer names real pages of the project and quotes their stored numbers correctly.
- Every turn settles a charge. The average credits per turn is recorded in the PR.

**Team**

- An invitation arrives within 2 minutes. The invitee sees the project within 1 minute of accepting.
- Removing the member ends their access at the next request.

**Billing**

- A test-mode purchase, a top-up and a cancellation each update the Billing page within 60 seconds of the Autumn event.
- A paid lookup lowers the balance by exactly the shown, settled cost.

**Reliability and monitoring**

- The uptime check stays green for 7 days in a row before the first outside invitation.
- No 5xx response appears in the sign-up and connection flows during the tests.
- A forced test error reaches monitoring in under 5 minutes, and an alert reaches the team.

**Data rights**

- The deletion runbook removes every row of a test user on a database copy, and a query proves it.
- The test user's Google grant disappears from their Google account permissions page after deletion.
- A D1 restore to a test database succeeds, and a row count matches the source time.

**Workflow**

- Live acceptance B5 steps 1 to 10 pass on S1, with a screenshot or link for each step: the opportunity, the draft, the pull request, the deployment record and the saved baseline.

**Legal and support**

- The privacy policy lists every service provider in use: Cloudflare, Google, OpenRouter, DataForSEO, Autumn, Loops, PostHog (if used), Trigger.dev and GitHub.
- A test email to `team@playbookmedia.io` gets a reply within 1 business day.
