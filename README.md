# Relay

**Keep what your SaaS promises, publishes, and delivers aligned as the product changes.**

Relay, by Playbook Media LLC, is building a system for the customer-facing work that follows every software change. When a release, pricing update, or new integration affects a website, documentation, customer journey, or sales material, Relay aims to identify what changed, locate the affected claims and workflows, prepare approved work, and verify the result in the system customers actually use.

**Today:** Relay has an open-source SEO and reviewed GitHub execution foundation. **Next:** commercialize website release assurance through Relay Protect, then build fact-backed content integrity through Relay Sync and coordinated commercial releases through Relay Launch. The broader operating system is a roadmap, not a finished product.

[Use Relay](https://relay.playbookmedia.io) · [Company thesis](company.md) · [North star](vision.md) · [Implement in order: IRFC-0001–0032](docs/maintainers/rfcs/implementation/README.md) · [Full technical RFCs](docs/maintainers/rfcs/README.md)

Relay is an independent, MIT-licensed codebase derived from [OpenSEO](https://github.com/every-app/open-seo). We retain its research foundation, license and attribution. Some package names and agent plugins still say OpenSEO. The upstream-sync workflow remains in place for reviewed changes.

## Current capabilities

The repository currently contains:

- Keyword research, rank tracking, backlinks, site audits, AI visibility and metered DataForSEO research.
- Google Search Console and GA4 integrations, evidence-backed SEO opportunities, investigations, and supported drafts.
- [GitHub publishing proposals](docs/GITHUB_PUBLISHING.md) for supported Next.js metadata and narrow text/Markdown changes. An authorized person approves the exact change; the customer keeps PR review, merge and deployment control.
- [Experiments and results](docs/EXPERIMENTS.md), SEO/release-quality checks against supplied previews, before-and-after measurements, page-group tests, and eligible accessibility/performance workflows.
- Documentation indexing, supported source-backed MDX/Markdown edits, scheduled jobs, notifications, spend limits, activity logging, and a weekly work view.
- Stripe revenue attribution and research/agent access subject to their configuration, consent, evidence and cost controls.

This is a substantial foundation, **not a completed Protect, Sync or Launch service**. The [dated release-assurance audit](docs/maintainers/relay-release-assurance-audit.md) describes the acceptance and integration gaps identified at the time of inspection; current implementation must be checked against the source and real deployment. In particular, existing checks or a merged PR do not by themselves prove a protected site is monitored or a production problem resolved.

## What we are building next

Three customer-facing offers share one planned **Product Reality Engine**:

| Product           | Customer outcome                                                                                                                                  | Delivery boundary                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Relay Protect** | Keep agreed production pages healthy, catch release regressions, prepare approved repairs and verify that they work.                              | **Initial paid entry.** Start with GitHub-managed Next.js sites; browser journeys are a later validated extension. |
| **Relay Sync**    | Keep public pricing, plan limits, feature and integration claims, and documentation consistent with verified product facts.                       | **Planned expansion.** Start with accepted facts and narrowly scoped Git-backed assets.                            |
| **Relay Launch**  | Turn a real product change into reviewed website, docs, announcement and sales-enablement work, with accountable owners and publication receipts. | **Planned expansion.** Start with fact-backed, manually approved launch packets.                                   |

The Product Reality Engine will link **source observations → scoped product facts → customer-facing claims and assets → impact findings → approved work → destination verification**. Source commits, deployed behavior, published statements, and measured commercial outcomes remain separate evidence. AI can help investigate and draft but cannot substitute for authority or silently publish.

### Implement in numerical order

The single contributor execution plan is [**IRFC-0001–0032**](docs/maintainers/rfcs/implementation/README.md):

1. **IRFC-0001–0007 — Protect:** agree a paid scope, capture known-good baselines, detect regressions, prepare source-mapped fixes, test exact previews, verify production and report recurring protection.
2. **IRFC-0008–0019 — Reality Engine + Sync:** validate the next buyer, ingest changes, establish scoped facts, match published claims, prepare reviewed corrections and verify outcomes.
3. **IRFC-0020–0022 — Launch:** check existing launch pages, build coordinated release packets and add read-only API/MCP workflows when demanded.
4. **IRFC-0023–0032 — extensions:** customer journeys, growth, conversion, adoption, support, sales and advanced controls; each is subject to its own customer and reliability gate.

Each IRFC links to the authoritative technical RFC and specifies the **slice and acceptance test**. Historical RFC-0001–0046 remain intact for code references and design history. Do not rebuild completed features simply to satisfy a number, or implement optional extensions without buyer evidence. [Company strategy](company.md) and [north-star vision](vision.md) describe why the milestones exist.

**First useful customer result:** a real production regression is detected, a supported repair is explicitly approved, the customer deploys it, and Relay verifies the original failure has cleared. The next milestone is a product change causing a verified published-claim discrepancy that Relay gets corrected and independently checks.

## Hosted plans and usage

The current [hosted Relay](https://relay.playbookmedia.io) research service has a free tier with $1 in monthly credits and a $10/month Base Plan with $10 in monthly credits, plus top-ups. DataForSEO and certain agent calls consume metered credits.

**Those hosted research plans are not subscriptions for Protect, Sync or Launch.** Protect is being tested as a bounded per-site paid service. Proposed Sync ($299–$999/month) and Launch ($399–$1,499/month) ranges are commercial hypotheses, not available plans or promised pricing. See [company.md](company.md) and the [pilot specification](docs/maintainers/rfcs/0026-protected-site-pilots-and-service.md).

Self-hosters supply their own provider credentials and cover provider and infrastructure costs. See [DataForSEO API key setup](docs/DATAFORSEO_API_KEY.md).

## Self-hosting

Relay supports two self-hosting paths. Both use email and password accounts: the first visitor creates the admin account, teammates join from invitation links, and MCP clients (Claude, ChatGPT, Codex, Cursor) sign in with the same accounts.

- **Docker** - On your own server or computer, with a prebuilt image that is ready in seconds. Works with Compose-based platforms such as Coolify, Portainer and Dokploy. See [`docs/SELF_HOSTING_DOCKER.md`](./docs/SELF_HOSTING_DOCKER.md).
  - Running the older single-container image? It keeps getting updates; [move to the new setup](./docs/SELF_HOSTING_DOCKER.md#move-from-the-old-docker-image) when you are ready, data included.
- **Cloudflare** - No server to run: one deploy command puts Relay on your own Cloudflare account (works on the free plan). See [`docs/SELF_HOSTING_CLOUDFLARE.md`](./docs/SELF_HOSTING_CLOUDFLARE.md).

For security-conscious setups, two advanced options replace the accounts with your own network controls:

- **Cloudflare Access** in front of the Cloudflare deploy, so Cloudflare checks every request before it reaches Relay. See [`docs/SELF_HOSTING_CLOUDFLARE.md`](./docs/SELF_HOSTING_CLOUDFLARE.md).
- **No sign-in on Docker**, behind Tailscale, a private network or your own authenticating proxy. See [Without sign-in](./docs/SELF_HOSTING_DOCKER.md#without-sign-in-advanced).

Self-hosted feature availability depends on configured integrations, credentials and deployment bindings. See [Local Postgres](docs/LOCAL_POSTGRES.md) for the optional database backend; D1/SQLite remains supported. Review the hosting guides before exposing an instance to the public internet.

## MCP and agent skills

The inherited MCP server and skills expose SEO research and supported growth workflows to agents. Growth tools can read evidence and draft within their permissions; they do not grant approval, merge, or deployment authority. Read-only change-impact APIs, event subscriptions and the broader Product Reality Engine MCP surface are planned, with permissions and costs defined in the implementation RFCs.

The [bundled MCP configuration](plugins/openseo/.mcp.json) points to `https://relay.playbookmedia.io/mcp`. Plugin branding and parts of the [plugin README](plugins/openseo/README.md) still use OpenSEO. The [upstream MCP setup guide](https://openseo.so/docs/mcp) explains client setup; use the Relay endpoint above, or your self-hosted endpoint and its supported authentication.

## Development and contributing

Follow [Local Development](docs/LOCAL_DEVELOPMENT.md) for Node, the pinned pnpm version, environment configuration, and local database migrations. Common commands after setup:

```sh
pnpm dev
pnpm test
pnpm types:check
pnpm format:check
```

Read [AGENTS.md](AGENTS.md), the [contribution guide](docs/CONTRIBUTING.md), and the [maintainer documentation](docs/maintainers/README.md). Start with the [sequential implementation queue](docs/maintainers/rfcs/implementation/README.md). The [historical RFC index](docs/maintainers/rfcs/README.md) preserves the detailed specifications, earlier engineering decisions, and live-acceptance caveats.

Retain upstream attribution and Playbook UI seams when integrating reviewed source improvements. GitHub detachment does not disable the existing upstream-sync workflow. See [LICENSE](LICENSE) for the MIT license and upstream copyright. The shared app theme adapts [Kaneo's CSS](https://github.com/PlaybookMediaLLC/kaneo/blob/develop/apps/web/src/index.css), with its [MIT notice](src/client/styles/kaneo.LICENSE).
