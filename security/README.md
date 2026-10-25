# Security assessment and repeatable scans

This directory contains local scanners, GitHub Actions checks, redacted findings,
and remediation evidence for the OpenSEO/Relay repository. The application is a
TypeScript/React TanStack Start service on Cloudflare Workers with SQLite/D1 and
Postgres persistence, MCP endpoints, scheduled/background work, a Docker self-host
image, and a separate marketing website. The root, `web`, and `tests/badseo`
workspaces have independent pnpm lockfiles. `tests/badseo` is an intentionally
broken SEO fixture; its dependency vulnerabilities still need assessment.

## Prerequisites and installation

Use Linux x86_64 for the complete automated toolchain. Install Bash, Python 3.12+,
Node 22+, the repository's pinned pnpm, Git, curl, tar/zstd/unzip, Java 21, and
Docker with BuildKit for image checks. Individual installers support additional
platforms where documented in their scripts. Python scanner packages use isolated
virtual environments and are not application dependencies.

```sh
export SECURITY_TOOLS_DIR="$HOME/.local/share/open-seo-security"
bash security/install.sh fast  # Gitleaks, TruffleHog, Semgrep, OSV, Trivy, Checkov
bash security/install.sh full  # also installs the CodeQL bundle
bash security/install.sh dast  # Nuclei and ZAP; see Burp instructions below
```

Versions are pinned in `security/install/*.sh` to the stable releases verified
during this assessment. Official release archives are checked against published
checksums; Python packages come from their official PyPI distributions. Review and
update pins periodically rather than silently downloading a new version every
scan. Installers may need several GB of disk space, particularly CodeQL. Use the
normal corporate proxy and CA trust; do not turn off TLS verification or bypass
network destination restrictions. Docker builds can accept a corporate CA as a
BuildKit `proxy_ca` secret without retaining it in the image.

CodeQL use must comply with GitHub's license: public repositories are supported;
private repositories require the appropriate GitHub Code Security entitlement.
Burp Community supports manual proxy inspection but does not include an automated
vulnerability scanner. Professional/DAST automation needs an appropriate license
and supported setup. Follow [the Burp checklist](configs/burp.md); no license,
interactive session, or proprietary scanner is emulated by these scripts.

## Running scans

```sh
bash security/scan.sh fast
# Full scans use a local image; the scanner never pulls the target image.
docker build -f deploy/docker/Dockerfile -t open-seo:security-assessment .
bash security/scan.sh full
# Optional: supply a NEW output directory. Existing directories are rejected.
bash security/scan.sh full /tmp/my-security-results
```

Each run writes into a new private `security/runs/` directory by default. Tools run
sequentially to bound resource usage, and an unavailable scanner does not prevent
the others from running. Each category produces a `*-summary.json` plus safe
native reports where available. `report.py` aggregates them into `findings.json`,
`findings.md`, and `findings.sarif`. The JSON records the revision, dirty-worktree
state, tool versions, commands, coverage, limitations, original IDs, severity,
confidence, evidence, impact, CWE/CVE identifiers, agent, and verification status.

Exit codes: `0` means the selected checks completed without open high/critical
or unclassified-severity findings; `1` means such findings remain; `2` means a required check or
report is incomplete. A deferred tool is explicitly outside that run's scope and
does not establish a clean result. Missing tools, database download failures, and
malformed reports must not appear as successful scans. Accepted risks remain
visible and do not bypass the high/critical gate. Review medium and low findings
in the registry even when the gate passes.

The checked-in `reports/` files are a reviewed snapshot, not a security baseline
that suppresses future detections. Fresh scans do not reuse an earlier run's success
state. The dependency baseline retains historical findings and compares them with
fresh, successfully completed audits of their affected workspaces. Duplicate
results merge only when they have the same explicit identity or the same
package/version and overlapping CVE/GHSA aliases; sharing a CWE alone is not enough.
Separate versions and image/OS ecosystems remain separate. Raw secrets, response
bodies, tokens, and credential verification requests must never enter reports or
agent instructions. Secret tools run without credential verification. Do not
publish arbitrary scanner logs; CI uploads only the redacted aggregate allowlist.

## Coverage

| Tool        | Coverage                                                                          | Limits                                                                                                         |
| ----------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Gitleaks    | Working source and reachable Git history                                          | Redacted detections require contextual triage; unreachable/deleted remote refs are not available locally       |
| TruffleHog  | Working source and Git history                                                    | Offline detection; does not validate credentials against providers                                             |
| Semgrep     | JavaScript/TypeScript security rules plus the repository redirect regression rule | Community analysis is not a proof of complete dataflow coverage                                                |
| CodeQL      | JavaScript/TypeScript and Python databases and security queries                   | Full mode; generated/vendor/build files are excluded; entitlement required where applicable                    |
| OSV-Scanner | All three pnpm lockfiles, including transitive packages                           | Needs vulnerability database/API access; API failure is recorded as blocked                                    |
| pip-audit   | Actual Python application dependency manifests, when present                      | Not applicable to the current stdlib-only Python helpers; scanner virtualenvs are not application dependencies |
| pnpm audit  | Supplementary registry advisories for all three lockfiles                         | Does not substitute for an OSV success claim                                                                   |
| Trivy       | Filesystem packages, supported configuration, and selected local Docker image     | Image assessment requires a completed build and vulnerability database                                         |
| Checkov     | Dockerfiles and GitHub Actions plus supported IaC definitions                     | Alchemy TypeScript and Wrangler JSONC require manual review                                                    |
| Nuclei      | Reviewed local GET templates against one authorized origin                        | No automatic template updates, OAST, fuzzing, or active exploit templates                                      |
| OWASP ZAP   | Passive analysis of explicit same-origin GET responses                            | No active scanner, authentication fuzzing, spider, or off-origin redirects                                     |
| Burp Suite  | Supported manual proxy review or licensed scanning                                | Installation, license, and interactive setup must be available; no fabricated results                          |

## Authorized runtime scans

Only use a disposable local application or an explicitly authorized staging
origin. Never use the production environment or load production credentials.
Run a local instance with dummy secrets and a disposable database, then:

```sh
SECURITY_DAST_TARGET=http://127.0.0.1:3000 \
SECURITY_DAST_AUTHORIZED=yes \
bash security/scan.sh dast
```

For staging, also set `SECURITY_DAST_ALLOWED_ORIGIN` to the exact approved origin.
Targets may not contain userinfo, paths, queries, or fragments. The runtime wrapper
validates scope before issuing requests. Paths are listed in
`configs/runtime-paths.json`; redirects are not followed. Missing targets are
deferred in static modes and fail in explicit DAST mode. A scan of a few public
endpoints is not verification of authenticated tenant authorization, paid provider
integrations, or the deployed production configuration.

## CI and maintainer setup

`.github/workflows/security.yml` runs fast checks on pull requests, full static
checks on Mondays at 06:23 UTC, and full or staging scans on manual dispatch. Jobs
use read-only repository permissions, ephemeral runners, and no saved checkout
credentials. Full scans include Git history. Reports are retained for 14 days.
Existing application CI continues to run tests, lint, types, and builds.

Before enabling staging dispatch, configure the `security-staging` GitHub
environment with required reviewers and an environment variable named
`SECURITY_DAST_ALLOWED_ORIGIN` containing the exact staging origin. The dispatch
input must match it. Ensure that protected-environment rules restrict the branches
that can run against staging. No staging target is preauthorized by this file.

Review `.github` changes with the configured CODEOWNER, as required by `AGENTS.md`.
Configure branch protection to require security checks and code-owner review where
the repository plan supports it. This task prepares the workflow files; remote
branch protection and environment settings are not silently changed. Resolve
documented blocked checks before treating the new status as passing.

## Remediation workflow

Use `findings.md` and `remediation.md` for the assessed snapshot. New detections
begin as unverified. Reproduce the issue safely and trace its affected code before
assigning a fix. Group confirmed findings by owner: A secrets, B application,
C dependencies, D infrastructure, E runtime. Give the owner redacted scanner
evidence, affected locations, reproduction, and explicit acceptance criteria.

A fix requires a focused regression where feasible, relevant application checks,
and a successful rerun of the original scanner/rule. Preserve the original
evidence and distinguish fixed, false positive, confirmed, unverified, and accepted
risk. Credential removal does not revoke an exposed credential: request rotation
without printing the value. Never rewrite shared Git history, modify production,
or run unverified code-editing loops. Automation reports findings; reviewed agents
and maintainers own code changes and verification.

Pipeline control tests use only the Python standard library:

```sh
python3 -m unittest discover -s security -p 'test_*.py'
```

Additional category-specific regression commands and assessment limitations are
recorded in `remediation.md` and the generated tool summaries.
