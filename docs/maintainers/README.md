# Maintainer documentation

Shared, versioned documentation for people maintaining Relay, the Playbook Media fork of OpenSEO. Put engineering decisions, development workflows, and useful maintenance notes here.

User-facing documentation belongs in the rest of `docs/` or `web/content/docs/`. This directory is not published to the documentation site, but its contents are tracked in the repository and must not contain secrets.

`review-guidelines.md` is the shared context for code reviewers, human and agent: hard invariants plus the false-positive controls that keep reviewers from flagging intentional behavior.

Create documents when they will help future maintenance or when explicitly requested. Keep task status, PR review notes, and validation results in the PR description. Log repository friction in `.agents/PAPERCUTS.md`.

`playbook-deployment.md` describes the PlaybookMediaLLC fork deployment at `relay.playbookmedia.io`: Cloudflare resources, external dependencies, the deploy workflow and one-time setup.

[The RFC delivery plan](rfcs/README.md) orders release assurance first, then organic growth expansion, with explicit dependencies and acceptance gates. RFC identifiers stay stable. The [current codebase audit](relay-release-assurance-audit.md) separates implemented capabilities from missing integration and customer validation. [Company](../../company.md) and [vision](../../vision.md) define the commercial thesis and north star.
