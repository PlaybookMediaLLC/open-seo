# Remediation and verification

> Integration update: this assessment records the original security branch. The branch has since incorporated newer `develop` changes. Fresh dependency audits now report zero findings in all three workspaces, including the previously open TOML advisories. See [develop integration evidence](reports/develop-integration.json) for current validation; earlier scanner and image reports remain historical snapshots.

Assessment scope: repository source, all locally reachable Git history, all three
pnpm workspaces, supported infrastructure definitions, a locally built self-host
container, and a disposable local application. No production or external staging
target was scanned. No infrastructure was deployed and no Git history was rewritten.

## Agent assignments and acceptance criteria

| Agent              | Assignment                                                                           | Required evidence                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| A — Secrets        | Gitleaks and TruffleHog; validate source/history detections and credential handling  | Redacted detection locations, exact-source triage, both tools rerun; rotation if a real exposed credential is identified      |
| B — Application    | Semgrep and CodeQL; validate source trust boundaries and remediate confirmed defects | Failing-before behavioral reproduction, minimal fix, passing regression, original scanner/query rerun                         |
| C — Dependencies   | OSV and supplemental pnpm audit across root, website, and fixture workspace          | Installed vulnerable versions, patched compatible versions, frozen lockfiles, package regression tests, repeated advisories   |
| D — Infrastructure | Trivy filesystem/image/config, Checkov, Docker context and CI permissions            | Actual synthetic image-context reproduction, safe build/runtime checks, current image inventory and rescans                   |
| E — Runtime        | Authorized local Nuclei/ZAP and supported Burp setup                                 | Healthy target and exact-origin scope, sanitized passive observations, explicit confidence and deployment-context limitations |
| Pipeline review    | Independent review of scanners, aggregation and GitHub Actions                       | Reproduced fail-open/coverage defects corrected; scope rejection and report-control regression tests                          |

Agents received the scanner evidence and affected code, were assigned independent
file ownership, and coordinated shared dependency and CI changes. Fixes below
have before/after evidence in the linked category reports. Scanner observations
without an established exploit path remain unverified, even when an advisory has
a high or critical database severity.

## Application fixes

- **Asset redirect SSRF and credential forwarding:** asset-size HEAD requests now
  validate every redirect through the established URL policy, scope crawler
  credentials to each destination, and bound redirect chains. Regressions cover a
  private-address redirect, cross-origin preview credential leakage, and loops.
  Both defect tests failed against the original implementation and passed after
  the fix; the detecting Semgrep rule was rerun.
- **User-controlled regular-expression CPU exhaustion:** split-test and release
  gate path matching now use RE2JS rather than native backtracking expressions.
  A small adversarial path exceeded a two-second isolated cutoff before the fix;
  the patched paths are tested with longer input. Inputs explicitly validate the
  supported syntax, and stored incompatible patterns produce actionable errors.
- **Release-tool temporary-file clobbering:** the release-note draft CLI now uses
  a private random temporary directory, exclusive private file creation, and
  cleanup. A CLI regression with a stub GitHub command reproduced clobbering via
  the original predictable path and verifies that the patched command leaves the
  victim intact. No release or message was published during testing.

**Compatibility action:** existing regex patterns containing lookaround or
backreferences must be rewritten using supported RE2 syntax. These features
cannot be preserved by a linear-time matcher. Invalid saved release-gate patterns
fail explicitly instead of silently dropping ignore rules. Review saved split-test
patterns and gate configuration before deployment.

See the application reports for exact finding IDs, locations, triage, scanner
coverage, and final query results.

## Dependency fixes

Compatible package and transitive updates remove 47 of the original 50 normalized
package/version/advisory findings, including all four original critical findings.
Website and fixture lockfiles have no remaining pnpm audit advisories. The root
retains three high advisories in development-only `effect → toml@4.3.0`.

The patched TOML major changes integer/date semantics. Forcing it into the pinned
Effect beta dependency is not considered verified compatibility. Upgrade the
owning upstream dependency or backport the security fixes with CLI parsing tests.
These findings remain open and block the high/critical gate; they are not suppressed.

The image assessment also found package-manager and bundled-toolchain advisories.
The root and Docker pnpm version were updated together to 10.34.8, and all three
frozen installs succeeded without changing lockfile hashes. Current image findings
and fixed toolchain records are in the infrastructure summary.

Two package regressions exercise the actual installed libraries: bounded Zod
array-error allocation and shell-quote rejection of comment/newline injection.
Both reproduced the original package defects without executing an injected
shell command and pass with the patched packages. MCP transport tests pass after
adding the protocol-version header required by the patched SDK to the test fixture.

Evidence: [dependency registry](reports/dependencies-summary.json) and
[dependency verification](reports/dependencies-verification.json).

## Infrastructure fixes and remaining risk

- Docker context filtering now excludes root and nested `.dev.vars`, `.env`, and
  environment-specific variants while retaining safe examples. An actual scratch
  image build with synthetic markers demonstrated inclusion before the fix and
  exclusion afterward. This identified a packaging risk, not proof that a real
  credential was shipped or compromised.
- Three existing GitHub workflows now declare read-only repository-token
  permissions. Checkov identified the missing declarations and was rerun after
  the changes. Actual prior privileges depended on repository/organization defaults.
- Full CI security jobs build their own local Docker image before scanning.
  Image configuration deliberately includes installed `node_modules`; source-tree
  exclusions must never be reused to hide installed image dependencies.
- The Docker startup test exposed a Node CLI compatibility bug: `auth-mode.ts`
  accessed Vite's `import.meta.env` when imported through the Node preflight.
  Optional access preserves the browser/build behavior and allows the CLI to
  start. A subprocess regression reproduces the original crash and checks the
  fixed local preflight. Container cold-start and restart outcomes are recorded
  separately; a successful image build alone is not treated as readiness.
- Container startup currently runs as root. Moving to a non-root user requires
  a tested migration for existing root-owned `.wrangler` volumes and writable
  build/cache directories. The conditional privilege-amplification risk remains
  open; no remote execution flaw is inferred solely from UID 0.

See [infrastructure remediation](reports/infrastructure-remediation.json), the
before/current image reports, and the infrastructure summary for build, startup,
package inventory, severity, patch availability, and remaining image risks.

## Secrets and runtime triage

Gitleaks and TruffleHog each scanned the worktree and 1,173 reachable commits.
Thirty-one detections normalized into 15 false positives: synthetic test data,
placeholders, public analytics ingestion identifiers, and a public ownership
challenge. Exact-source hash checks prevent future changed source from inheriting
these decisions. No exposed credential was confirmed, so no rotation was requested.
Ignored local environment files, unreachable objects, and unfetched remote refs
are outside this claim. See [secret assessment](reports/secrets-assessment.md).

Nuclei and ZAP ran against a healthy disposable local app with dummy credentials.
Eight fixed GET paths included health, session, MCP authentication, and sensitive
file exposure checks. Twenty-two alerts deduplicate to 11 observations: three
medium CSP-hardening observations, five low missing-nosniff observations, and three
informational false positives. The eight hardening observations require authorized
staging verification; development middleware and intentionally limited CSP coverage
do not prove a production exploit. No runtime vulnerability was marked fixed.
See [runtime assessment](reports/runtime-assessment.md).

## Coverage blockers and required actions

- **OSV:** the installed scanner parsed all three lockfiles but `api.osv.dev`
  requests were proxy-denied. Permit that official service through the supported
  environment configuration and rerun. pnpm and Trivy results supplement this
  missing coverage; they do not turn the OSV attempt into a successful scan.
- **Semgrep:** native parser warnings are retained as incomplete coverage. Review
  the [manual warning-fragment review](reports/parser-review.json) and rerun with
  a parser release that supports these files. That review does not turn partial
  automated coverage into a successful scan.
- **Burp:** the official PortSwigger download was proxy-denied. Install through
  the approved network path, then perform supported manual Community inspection
  or supply licensed Professional/DAST setup. No license bypass or fabricated
  result is supplied.
- **Python dependency audit:** pip-audit is not applicable because application and
  security helpers use no third-party Python dependencies. Scanner virtualenvs
  are tooling and are not silently treated as application manifests.
- **Staging and authenticated coverage:** authorize an exact staging origin and
  appropriate test identities before testing authenticated tenant journeys or
  deployed headers. No production, third-party or paid-provider scan is authorized
  by the local results.
- **Maintainer review:** `AGENTS.md` requires explicit maintainer review for
  `.github` changes. Review and merge the workflow, configure required status/code
  owner checks, and protect `security-staging` with reviewers and its exact-origin
  variable. Remote repository settings were not changed by this task.

No broad finding suppressions, disabled security controls, credential rotations,
production changes, or unverified automated code-edit loops were introduced.
The machine-readable registry retains unresolved findings and incomplete tools.

## Validation evidence

The final command outcomes are recorded in [validation.json](reports/validation.json).
Category reports preserve failing-before and passing-after security regressions.
The GitHub workflow also runs report-control, secret-redaction, runtime-scope, and
real Docker-context tests; existing application CI runs dependency regressions
alongside the normal test, lint, type, and build checks.
