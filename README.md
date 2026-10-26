# Relay

**Website release assurance and organic growth automation by Playbook Media LLC.**

Relay is being built to protect and grow organic acquisition for developer-led B2B SaaS teams. It connects website evidence, reviewable GitHub changes, production verification, and outcome measurement through the tools a team already uses.

[Hosted Relay](https://relay.playbookmedia.io) · [Company](company.md) · [Vision](vision.md) · [RFC delivery plan](docs/maintainers/rfcs/README.md)

Relay is an MIT-licensed, upstream-tracking fork of [OpenSEO](https://github.com/every-app/open-seo). We retain its SEO research foundation and attribution while building the release-assurance workflow. Internal package names, plugin directories, and upstream setup guides may still use OpenSEO.

## Current capabilities

The repository includes:

- Keyword research, rank tracking, backlink analysis, technical site audits, AI visibility, and DataForSEO integration.
- Search Console and GA4 connections, evidence-backed opportunities, investigations, and draft preparation.
- [Reviewed GitHub proposals](docs/GITHUB_PUBLISHING.md) for supported Next.js metadata and other narrowly supported edits. A person authorizes the exact change; Relay opens a pull request. Customer review, merge, and deployment remain under their control.
- [Experiments and results](docs/EXPERIMENTS.md), deployment signals, scheduled measurement, and before/after search and conversion observations.
- SEO and release-quality checks against supplied previews, accessibility and performance workflows, page-group tests, and Stripe attribution subject to their setup and data requirements.
- Scheduled jobs, notifications, spending limits, activity records, and a weekly work view and monthly report.

See [Opportunities](docs/OPPORTUNITIES.md) for the existing review workflow. Implementation and historical smoke tests do not establish a fully validated paid release-assurance service. The [codebase audit](docs/maintainers/relay-release-assurance-audit.md) records the current boundaries.

## What we are building next

The first product protects a small set of important pages on GitHub-managed Next.js websites:

1. Establish known-good production snapshots and confirm release regressions.
2. Map a confirmed problem to a supported source edit and prepare a narrow repair.
3. Check the proposed commit through the customer's preview and CI process.
4. After customer approval, merge, and deployment, rerun the original production check.
5. Report coverage, verified resolutions, approvals, and subsequent outcomes.

Persistent production monitoring, incident-based repair proposals, proposal-bound previews, and general repair verification are planned work. Current deployment checks compare titles and descriptions; broader edits may require human deployment attestation and feature-specific checks. Static route and literal-edit limits apply; dynamic routes, arbitrary CMS writes, and universal framework support are not implied.

The [ordered RFC plan](docs/maintainers/rfcs/README.md) delivers this in useful increments. Standing approvals, automatic merging, broad content generation, and portfolios are deferred until customer demand and reliability justify them.

## Hosted plans and usage

Use [Relay](https://relay.playbookmedia.io). Repository configuration defines a free research tier with $1 in monthly usage credits and a $10/month Base Plan with $10 in monthly credits, plus paid top-ups. Paid research consumes credits.

Release-assurance pricing of **$79–$149 per protected website per month** is a pilot hypothesis, not an available plan promised by this README. Scope and economics are defined in [company.md](company.md) and [RFC-0026](docs/maintainers/rfcs/0026-protected-site-pilots-and-service.md).

Self-hosted users supply their own provider credentials and pay their providers and hosting directly. See the [DataForSEO API key guide](docs/DATAFORSEO_API_KEY.md).

## Self-hosting

Relay supports two self-hosting paths. Both use email and password accounts: the first visitor creates the admin account, teammates join from invitation links, and MCP clients (Claude, ChatGPT, Codex, Cursor) sign in with the same accounts.

- **Docker** - On your own server or computer, with a prebuilt image that is ready in seconds. Works with Compose-based platforms such as Coolify, Portainer and Dokploy. See [`docs/SELF_HOSTING_DOCKER.md`](./docs/SELF_HOSTING_DOCKER.md).
  - Running the older single-container image? It keeps getting updates; [move to the new setup](./docs/SELF_HOSTING_DOCKER.md#move-from-the-old-docker-image) when you are ready, data included.
- **Cloudflare** - No server to run: one deploy command puts Relay on your own Cloudflare account (works on the free plan). See [`docs/SELF_HOSTING_CLOUDFLARE.md`](./docs/SELF_HOSTING_CLOUDFLARE.md).

For security-conscious setups, two advanced options replace the accounts with your own network controls:

- **Cloudflare Access** in front of the Cloudflare deploy, so Cloudflare checks every request before it reaches Relay. See [`docs/SELF_HOSTING_CLOUDFLARE.md`](./docs/SELF_HOSTING_CLOUDFLARE.md).
- **No sign-in on Docker**, behind Tailscale, a private network or your own authenticating proxy. See [Without sign-in](./docs/SELF_HOSTING_DOCKER.md#without-sign-in-advanced).

## MCP and agent skills

The inherited MCP server and skills expose SEO research and supported growth workflows to agents. Growth tools can read evidence and draft within their permissions; they do not grant approval, merge, or deployment authority.

This fork's [bundled MCP configuration](plugins/openseo/.mcp.json) points to `https://relay.playbookmedia.io/mcp`. Plugin branding and parts of the [plugin README](plugins/openseo/README.md) still use OpenSEO. The [upstream MCP setup guide](https://openseo.so/docs/mcp) explains client setup; use the Relay endpoint above, or your self-hosted endpoint and its supported authentication.

## Self-hosting

- [Docker](docs/SELF_HOSTING_DOCKER.md): try the application on your own machine.
- [Cloudflare](docs/SELF_HOSTING_CLOUDFLARE.md): internet-facing deployment for a team or multiple devices.
- [Local Postgres](docs/LOCAL_POSTGRES.md): the optional database backend; D1/SQLite remains supported.

Feature availability depends on configured integrations, credentials, and deployment bindings. Read the guides before exposing a local instance to the internet.

## Development and contributing

Follow [Local Development](docs/LOCAL_DEVELOPMENT.md) for Node, the pinned pnpm version, environment configuration, and local database migrations. Common commands after setup:

```sh
pnpm dev
pnpm test
pnpm types:check
pnpm format:check
```

Read [AGENTS.md](AGENTS.md), the [contribution guide](docs/CONTRIBUTING.md), and the [maintainer documentation](docs/maintainers/README.md). The [RFC index](docs/maintainers/rfcs/README.md) separates implemented foundations, live acceptance work, and future product increments.

Keep upstream core improvements and Playbook UI seams compatible with the fork's sync policy. See [LICENSE](LICENSE) for the MIT license and upstream copyright.
