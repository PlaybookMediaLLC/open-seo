# Security findings — 2026-10-25

> Integration update: this assessment records the original security branch. The branch has since incorporated newer `develop` changes. Fresh dependency audits now report zero findings in all three workspaces, including the previously open TOML advisories. See [develop integration evidence](reports/develop-integration.json) for current validation; earlier scanner and image reports remain historical snapshots.

**Security coverage is incomplete and unresolved findings remain.** The repository assessment, remediation, local runtime checks and repeatable pipeline have been executed. No production target was scanned or deployed.

## Results

- Fixed three application defects: redirect SSRF/credential forwarding, regex CPU exhaustion, and release-tool temporary-file clobbering.
- Resolved 47 of 50 original workspace dependency findings, including all four original critical findings. Three development-only TOML advisories remain.
- Fixed Docker credential-file inclusion and workflow token-permission declarations. Hardened the image and corrected a cold-start preflight bug found by testing.
- Image scanner records decreased from **4,754 to 357**: OS records 4,575 → 242; npm records 70 → 6; embedded Go records remain 109. Detection counts do not establish exploitability.
- Final application tests: **2,912 passed across 380 files**. Complete CI checks, application/website builds, and the final container cold-start/restart checks passed.

## Normalized registry

The current registry contains **566 canonical findings**: 52 fixed, 149 false positives, 4 confirmed open, and 361 unverified. Unverified findings include installed-component advisories whose runtime exploitability has not been established.

| Severity      | Confirmed open | Unverified | Fixed | False positive |
| ------------- | -------------: | ---------: | ----: | -------------: |
| Critical      |              0 |          1 |     4 |              1 |
| High          |              3 |        112 |    23 |             25 |
| Medium        |              1 |        148 |    19 |             67 |
| Low           |              0 |         98 |     6 |             53 |
| Informational |              0 |          0 |     0 |              3 |
| Unclassified  |              0 |          2 |     0 |              0 |

The aggregate keeps the most open status when scanners/components overlap. One advisory fixed in an application workspace still exists in the image toolchain; its primary location points to the remaining component, and `observations` preserves the closed workspace evidence. The 47-workspace-fix count therefore differs from canonical fixed-finding totals. Thousands of removed image detections remain in the before-image report and the grouped, verified image-hardening finding rather than being presented as thousands of demonstrated exploits.

Every canonical finding retains scanner/rule, severity, confidence, affected location, description, CWE/CVE aliases, evidence, impact, recommendation, owner, status, and verification. Cross-scanner duplicates preserve their original IDs and per-source observations.

- [Complete JSON registry](reports/findings.json)
- [Detailed readable registry](reports/findings.md)
- [Aggregate SARIF](reports/findings.sarif)
- [Remediation and acceptance evidence](remediation.md)

## Confirmed open findings

| Finding            | Severity | Remaining action                                                                                                                                                                               |
| ------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEP-3abd08fe4018` | high     | Upgrade effect to a version using patched TOML, or backport the parser fix with compatibility tests. Do not blindly override toml 4 with 5: v5 changes integer/date values to BigInt/Temporal. |
| `DEP-44710332d9ca` | high     | Upgrade effect to a version using patched TOML, or backport the parser fix with compatibility tests. Do not blindly override toml 4 with 5: v5 changes integer/date values to BigInt/Temporal. |
| `DEP-e7df9bca0557` | high     | Upgrade effect to a version using patched TOML, or backport the parser fix with compatibility tests. Do not blindly override toml 4 with 5: v5 changes integer/date values to BigInt/Temporal. |
| `INFRA-ROOT-USER`  | medium   | Migrate existing root-owned /app/.wrangler volumes and writable build/cache paths before adopting USER node; validate upgrade and restart behavior.                                            |

## Unverified image and runtime observations

The final image contains 356 unverified advisory records, including one critical advisory in the Go runtime embedded in a build tool. The critical zlib/MiniZip report is a validated false positive: the affected MiniZip package and vulnerable symbol are absent. No broad advisory suppression was added.

All available Debian updates were applied; the 242 remaining distro records have no vendor-fixed version in the scanned database. Three npm image records are the same TOML issues already tracked in the workspace. The other three concern bundled npm dependencies; the inspected newer npm major contains the same versions, so an additional major upgrade would not resolve them. Current findings record these upstream/toolchain limits and require reachability validation or a maintained, tested fix.

Local Nuclei/ZAP observations deduplicate to three medium CSP and five low nosniff hardening observations, plus three informational false positives. No runtime exploit was confirmed. Verify deployed headers and authenticated journeys against an explicitly authorized staging origin before treating these development responses as production findings.

## Tool execution and coverage

| Tool / scope              | Version                    | Recorded status |
| ------------------------- | -------------------------- | --------------- |
| gitleaks / worktree       | 8.30.1                     | success         |
| gitleaks / history        | 8.30.1                     | success         |
| trufflehog / worktree     | trufflehog 3.99.7          | success         |
| trufflehog / history      | trufflehog 3.99.7          | success         |
| Semgrep                   | 1.182.1                    | error           |
| CodeQL / javascript       | 2.27.3                     | success         |
| CodeQL / python           | 2.27.3                     | success         |
| OSV-Scanner               | osv-scanner version: 2.7.0 | blocked         |
| pnpm audit (.)            | 10.30.1                    | success         |
| pnpm audit (tests/badseo) | 10.30.1                    | success         |
| pnpm audit (web)          | 10.30.1                    | success         |
| pip-audit                 | —                          | not_applicable  |
| Trivy config              | Version: 0.76.1            | success         |
| Trivy dependencies        | Version: 0.76.1            | success         |
| Trivy image               | Version: 0.76.1            | success         |
| Checkov repository        | 3.3.30                     | success         |
| Checkov github-actions    | 3.3.30                     | success         |
| Nuclei                    | 3.11.1                     | success         |
| OWASP ZAP                 | 2.17.0                     | success         |
| Burp Suite                | —                          | blocked         |

- Secrets: worktree and 1,173 reachable commits; 31 detections normalized to 15 false positives. No exposed credential was confirmed and no rotation was requested. Ignored local environment files and unavailable Git objects are outside this claim.
- CodeQL: complete 2,001-file JS/TS and 13-file Python snapshots. Later small CLI/helper/reporting changes received focused Semgrep checks; exact snapshot timing is retained in application verification.
- Semgrep: official JS/TS/Python security rules executed, with six parser warnings retained as partial/error coverage. [Manual warning-fragment review](reports/parser-review.json) supplements that limitation without claiming a clean scan.
- OSV-Scanner: installed, version verified, all three lockfiles parsed; API access was proxy-denied. pnpm audit and Trivy supply separate completed dependency evidence.
- pip-audit: not applicable; repository Python helpers use the standard library and have no application dependency manifests.
- Trivy and Checkov: all five filesystem/config/image/IaC runs completed. Unsupported Wrangler JSONC, Alchemy TypeScript and Compose definitions were manually reviewed.
- Nuclei and ZAP: installed and executed conservative GET/passive checks against a healthy disposable local application. Sensitive file requests were denied/not found; unauthenticated MCP access was rejected.
- Burp: official download blocked by the proxy; no binary/license/interactive setup was available. Supported Community/manual and licensed scanning requirements are documented; no Burp scan is claimed.

## Validation and required follow-up

[Validation results](reports/validation.json) record tests, formatting, types, lint, builds, workflow validation, scanner-report safety, runtime scope, real Docker context filtering, and end-to-end scan execution. [Infrastructure verification](reports/infrastructure-verification.json) ties the final scan and successful startup/restart to the same image digest.

The unified fast run returned exit **2**, correctly retaining OSV access failure and partial Semgrep coverage. Full aggregation also remains incomplete and does not hide open high/critical or unclassified findings.

Required follow-up: resolve the three TOML advisories through a compatible upstream fix/backport; validate remaining image reachability and upstream patches; design a migration for root-owned self-host volumes before switching container users; allow the official OSV/Burp destinations and configure supported Burp use; update parser support; and authorize staging identities/targets for further runtime checks.

Existing regex patterns using lookaround or backreferences require migration to supported RE2 syntax. See remediation notes before deployment. Workflow changes remain local and require the maintainer review mandated by `AGENTS.md`; configure protected staging and required checks when merging. No remote branch-protection or environment settings were changed.

[Installation, usage and CI configuration](README.md).
