import type { Plugin } from "vite";

/**
 * Playbook fork: the product ships as "Relay". Upstream source says "OpenSEO"
 * in ~90 files (UI copy, MCP metadata, AI prompts), so this rewrites the brand
 * in app modules at dev and build time instead of editing those files, which
 * would conflict on every upstream merge. New upstream copy is renamed for free.
 *
 * Unit tests run without app plugins, so they keep upstream's strings.
 *
 * Fork seams that keep the rename complete (audit: `grep -rn playbook-seam`):
 * - vite.config.ts: mounts this plugin and the docs plugin.
 * - src/client/features/ai-mcp/agentInstalls.ts: agent setup links use Relay
 *   guides instead of marketplace listings connected to upstream.
 * - src/lib/auth-api-key.ts: new API keys start with `relay_`.
 * - src/shared/terms.ts: acceptance links open Relay's /terms and /privacy
 *   pages, which identify Playbook Media LLC as the operator.
 * - src/routes/__root.tsx: icon links come from src/lib/relay-icons.ts.
 * - src/routes/__root.tsx: public pages render on the server too
 *   (src/client/components/RelayClientOnly.tsx).
 * - vite.config.ts: the Playbook build prerenders the public pages to static
 *   HTML (vite-relay-start.ts).
 * - src/routes/__root.tsx: unknown URLs get the landing 404
 *   (src/client/features/landing/LandingNotFound.tsx).
 * - src/public/: site.webmanifest names and the icon PNGs carry the Relay
 *   brand, because static files skip the module pipeline.
 * - plugins/openseo/.mcp.json: the agent plugin connects to this deployment.
 * - plugins/openseo/assets/icon.png and the Cursor manifest's logo URL: the
 *   agent plugin shows the Relay mark.
 * - deploy/alchemy/alchemy.run.ts: binds EMAIL for team invites
 *   (src/server/email/relay-email.ts) and spreads relayDataEnv, the fork's
 *   worker settings such as the GitHub App (deploy/alchemy/relay-env.ts).
 * - src/serverFunctions/organization.ts and src/env.d.ts: invites go through
 *   the Cloudflare EMAIL binding.
 * - src/server.ts: loads the growth E2E provider fake
 *   (src/server/e2e/growthFixtures.ts), inert outside E2E builds.
 * - knip.jsonc: lists the growth E2E spec (tests/growth-workflow.e2e.ts).
 * - src/server/mcp/tools/project-context.ts: get_project_context and
 *   update_project_context read and save brand terms (RFC-0002), and an
 *   update may change only the brand terms. Its upstream test mocks the
 *   brand-term store (src/server/mcp/tools/project-context.test.ts).
 * - src/routes/_app/p/$projectId/context.tsx: mounts the brand-terms editor
 *   (src/client/features/opportunities/BrandTermsSection.tsx).
 * - src/server/features/audit/AuditScratchpad.ts and
 *   src/server/workflows/siteAuditWorkflowPhases.ts: an audit saves the pages
 *   that link to each money or hub key page before finalize destroys the
 *   scratchpad (RFC-0002 internal links;
 *   src/server/features/opportunities/audit/). The workflow file was at the
 *   400-line lint limit, so its seam also turns that rule off for the file.
 * - src/server/mcp/server.ts and src/server/features/sam/samChatTools.ts:
 *   register the growth tools for agents (RFC-0004;
 *   src/server/mcp/tools/growth-tools.ts).
 * - src/server/mcp/tools/google-connection-tools.ts: successful Google
 *   property changes record audit events with the verified project and
 *   MCP actor, matching the dashboard integration setters.
 * - src/server/features/sam/samSystemPrompt.ts: adds the growth workflow rules
 *   (src/server/features/sam/growthPrompt.ts).
 * - knip.jsonc: lists the Trigger.dev config and tasks (trigger.config.ts,
 *   trigger/), which only the Trigger.dev CLI reads (RFC-0008).
 * - src/client/components/Sidebar.tsx: mounts the notification bell
 *   (src/client/features/notifications/NotificationsBell.tsx).
 * - src/server/workflows/siteAuditWorkflowPhases.ts: a completed audit queues
 *   its follow-up job (src/server/features/growth/auditFollowup.ts).
 * - src/server/workflows/siteAuditWorkflowPhases.ts: after Lighthouse, an
 *   audit runs axe-core on up to 50 pages
 *   (src/server/features/accessibility/accessibilityStep.ts).
 * - src/server/features/audit/services/AuditService.ts: starting an audit
 *   saves its top-clicked pages for that step
 *   (src/server/features/accessibility/accessibilityTargets.ts).
 * - src/audit-worker.ts: the audit worker runs the three Lighthouse lab
 *   checks of a performance fix, so their payloads never reach the app
 *   worker (src/server/features/performance/labChecks.ts).
 * - src/server/features/gsc/services/GscService.ts: connecting Search Console
 *   starts the default growth schedules (src/server/features/growth/).
 * - src/client/features/projects/SettingsTabs.tsx: adds the Automation tab
 *   (src/client/features/automation/AutomationSettings.tsx), the Spending
 *   tab (src/client/features/spend/ProjectSpending.tsx), the SEO checks
 *   tab (src/client/features/seo-checks/SeoChecksSettings.tsx) and the
 *   Conversion tab (src/client/features/conversion/ConversionSettings.tsx).
 * - src/routes/_app/billing.tsx: mounts the spending limit card
 *   (src/client/features/spend/SpendLimitsCard.tsx).
 * - src/routes/_app/route.tsx: shows the spending limit banner above the
 *   plan banner (src/client/features/spend/SpendLimitBanner.tsx).
 * - src/client/components/QueryState.tsx: a refused paid action links to
 *   Billing (src/client/features/spend/SpendLimitError.tsx).
 * - src/server/billing/subscription.ts: reserveUsageCredits and
 *   settleUsageCredits take an optional provider (RFC-0009 5.3).
 * - src/server/features/ai-visibility/services/aiPromptSuggestions.ts and
 *   src/server/features/projects/services/websiteResearch.ts: AI research
 *   holds its estimate first (src/server/billing/researchHold.ts); the
 *   website research test mocks that module.
 * - src/server/features/sam/SamChatAgent.ts: each turn reserves 50 credits,
 *   records its metered chunks and releases the reservation
 *   (src/server/billing/assistantSpend.ts). The seams push the file past the
 *   line limit, so it carries a max-lines exemption.
 * - src/server/lib/dataforseo/envelope.ts: parseTaskItems keeps the cost of a
 *   billed task whose payload fails validation (RFC-0009 debt 1).
 * - src/server/workflows/RankCheckWorkflow.ts,
 *   src/server/features/ai-visibility/services/scheduledAiVisibility.ts,
 *   src/shared/rank-tracking.ts and the two rank-tracking views: scheduled
 *   checks at a monthly limit skip with their reason. The rank workflow test
 *   mocks the room check.
 * - src/routes/_app/settings.tsx: adds the Activity tab
 *   (src/client/features/activity/ActivityLog.tsx).
 * - src/serverFunctions/gsc.ts, src/serverFunctions/ga4.ts and
 *   src/serverFunctions/organization.ts: record integration and invitation
 *   audit events after the change (src/server/features/activity/auditLog.ts).
 * - src/lib/auth.ts: a hooks.after middleware records member removal and
 *   API key changes (src/server/features/activity/authAudit.ts).
 * - deploy/alchemy/alchemy.run.ts: spreads the fork bindings, the paid
 *   action and CI check rate limits (deploy/alchemy/relay-env.ts).
 * - wrangler.jsonc and src/server.ts: declare and export the SEO check
 *   Workflow (src/server/features/seo-checks/SeoCheckWorkflow.ts).
 * - src/server.ts: the scheduled handler runs the due growth jobs, the spend
 *   reconcile and the retention on the Worker cron when Trigger.dev is not
 *   configured (src/server/features/growth/cronScheduler.ts).
 * - src/server/lib/dataforseo/client.ts: DataForSEO calls reserve inside the
 *   monthly spend limits (src/server/billing/spendAdmission.ts). The import of
 *   upstream's reserveUsageCredits is removed there.
 * - src/server/billing/subscription.ts: each hold settlement is recorded on
 *   the spend ledger (src/server/billing/spendLedger.ts).
 * - src/server/lib/dataforseo/client.test.ts: the spend limit and ledger
 *   modules pass through to upstream's billing in this test.
 * - src/shared/error-codes.ts and src/client/lib/error-messages.ts: the
 *   SPEND_LIMIT_REACHED code and its copy (src/shared/spendLimits.ts).
 * - src/client/navigation/items.ts: adds "This week" first in the project
 *   navigation (RFC-0018; src/client/features/work/ThisWeekPage.tsx).
 * - src/client/features/dashboard/DashboardPage.tsx: shows the This week
 *   card at the top of the project home
 *   (src/client/features/work/ThisWeekCard.tsx).
 */
const RELAY = "https://relay.playbookmedia.io";

const REPLACEMENTS: [RegExp, string][] = [
  // Whole word only, so identifiers like isOpenSEOHost stay intact. The `\n`
  // escape case covers `?raw` markdown, which arrives as a JSON string.
  [/(?<=^|\W|\\[nrt])OpenSEO(?!\w)/g, "Relay"],
  // Support mail must reach Playbook Media, not the upstream maintainers.
  [/support@openseo\.so/g, "team@playbookmedia.io"],
  // Upstream's hosted app is the fallback origin (SSR, the AI assistant's MCP
  // URL); ours must point users at this deployment, not at app.openseo.so.
  [/https:\/\/app\.openseo\.so/g, RELAY],
  // Help links go to Relay's own docs (content/docs, served at /docs).
  [
    /https:\/\/openseo\.so\/blogs\/google-search-console-setup/g,
    `${RELAY}/docs/google-search-console`,
  ],
  [/https:\/\/openseo\.so\/docs/g, `${RELAY}/docs`],
  [/https:\/\/openseo\.so\/blog\b/g, `${RELAY}/docs`],
  // Pricing is a section of the landing page; keep any query string.
  [/https:\/\/openseo\.so\/pricing(\?[^"'`\s)\]#]*)?/g, `${RELAY}/$1#pricing`],
  [/https:\/\/(?:www\.)?openseo\.so/g, RELAY],
  // Source links (skills, self-hosting notes) point at this fork.
  [/github\.com\/every-app\/open-seo/g, "github.com/PlaybookMediaLLC/open-seo"],
];

const BRANDED_FILE = /\.(?:[cm]?[jt]sx?|mdx?)$/;

export function relayBrand(): Plugin {
  let root = process.cwd();
  return {
    name: "playbook-relay-brand",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    transform(code, id) {
      // Any project file, not just src/: the agent setup prompt is imported
      // from .agents/. Matching on a "/src/" path segment only worked on
      // machines whose checkout path happened to contain one.
      const file = id.split("?")[0] ?? id;
      if (
        !file.startsWith(`${root}/`) ||
        file.includes("/node_modules/") ||
        !BRANDED_FILE.test(file)
      ) {
        return null;
      }
      const next = REPLACEMENTS.reduce(
        (text, [pattern, value]) => text.replace(pattern, value),
        code,
      );
      // ponytail: map null keeps line numbers (no lines move) but columns
      // drift by a few characters on rewritten lines; emit a real map with
      // magic-string if column-exact sourcemaps ever matter.
      return next === code ? null : { code: next, map: null };
    },
  };
}
