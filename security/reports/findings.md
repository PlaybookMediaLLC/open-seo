# Security scan results

Generated: 2026-10-25T18:23:23.786029+00:00

Mode: `full`. Gate: **incomplete**.

Deferred and unsupported tools are coverage limitations, not clean scans.

## Tool coverage

| Tool | Version | Status |
| --- | --- | --- |
| gitleaks | 8.30.1 | success |
| gitleaks | 8.30.1 | success |
| trufflehog | trufflehog 3.99.7 | success |
| trufflehog | trufflehog 3.99.7 | success |
| Semgrep | 1.182.1 | error |
| CodeQL | 2.27.3 | success |
| CodeQL | 2.27.3 | success |
| OSV-Scanner | osv-scanner version: 2.7.0 | blocked |
| pnpm audit (.) | 10.30.1 | success |
| pnpm audit (tests/badseo) | 10.30.1 | success |
| pnpm audit (web) | 10.30.1 | success |
| pip-audit | None | not_applicable |
| Trivy config | Version: 0.76.1 | success |
| Trivy dependencies | Version: 0.76.1 | success |
| Trivy image | Version: 0.76.1 | success |
| Checkov repository | 3.3.30 | success |
| Checkov github-actions | 3.3.30 | success |
| Nuclei | 3.11.1 | success |
| OWASP ZAP | 2.17.0 | success |
| Burp Suite | None | blocked |

## Findings

### DEP-4e6c114cadf9 — critical — fixed

shell-quote: `quote()` command injection via a line terminator in a token after a `{ comment }` token

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-102422, CWE-78, GHSA-pqg4-j6r4-53mv.

Evidence: ['Lockfile resolves shell-quote@1.9.0; advisory affected range: >=1.8.4 <1.11.0.', '.>@tanstack/devtools-vite>launch-editor>shell-quote']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 1.11.0 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-7b42a18a661b — critical — fixed

DOMPurify SAFE_FOR_TEMPLATES bypass: split template expressions survive in attached shadow root content on DOM output modes

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CWE-79, GHSA-cg2g-xh64-v4q7.

Evidence: ['Lockfile resolves dompurify@3.4.16; advisory affected range: >=3.4.4 <=3.4.16.', '.>posthog-js>dompurify']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 3.4.17 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-98157b8446e1 — critical — fixed

Seroval: `fromJSON()` Promise thenable assimilation invokes plugin-produced callables (bypass of GHSA-mv8w-475r-vwqw)

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-104846, CWE-843, GHSA-p6vx-979v-rg4c.

Evidence: ['Lockfile resolves seroval@1.5.6; advisory affected range: >=0.12.0 <=1.6.0.', '.>@tanstack/react-devtools>@tanstack/devtools>solid-js>seroval']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 1.6.2 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-f13d73756c25 — critical — fixed

proxy-addr vulnerable to IP spoofing via IPv4-mapped IPv6 trust subnet

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-90711, CWE-290, CWE-348, CWE-697, GHSA-jqcg-44mw-7w3h.

Evidence: ['Lockfile resolves proxy-addr@2.0.7; advisory affected range: >=1.1.0 <2.0.8.', '.>shadcn>@modelcontextprotocol/sdk>express>proxy-addr']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 2.0.8 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### INFRA-C5205C6D5E0A — critical — false_positive

zlib: integer overflow and resultant heap-based buffer overflow in zipOpenNewFileInZip4_6

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2023-45853, CWE-190.

Evidence: Scanner matched zlib1g@1:1.2.13.dfsg-1 against its vulnerability database.

Impact: This advisory affects MiniZip zipOpenNewFileInZip4_64, not the shipped libz.so API. Debian zlib1g package contains libz.so and documentation only.

Remediation: Retain exact package/version evidence; reassess if MiniZip is installed in a future image. No scanner rule was suppressed.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used.", "Actual zlib1g file list and ELF symbol-byte inspection found no MiniZip library or zipOpenNewFileInZip4_64; minizip/libminizip1 package query returned no installed packages.", "Evidence is in infrastructure-zlib-evidence.json; final image has the same zlib1g1:1.2.13.dfsg-1 package version."]

### INFRA-E348DB049115 — critical — unverified

crypto/tls: crypto/tls: Incorrect certificate validation during TLS session resumption

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2025-68121, CWE-295.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### SEC-B-633c4d83a337 — high — false_positive

Reviewed dangerous-subprocess-use-audit audit match.

Location: `security/scanners/dependencies.py:25`. Agent: B. Confidence: high.

Identifiers: CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection').

Evidence: Operator-invoked local scanner runner. Commands use argument arrays with shell=False; executable paths come from trusted local scanner installation/configuration, not an HTTP request. Environment overrides are an explicit operator trust boundary.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-5890ada053b0 — high — false_positive

Reviewed dangerous-subprocess-use-audit audit match.

Location: `security/scanners/runtime.py:92`. Agent: B. Confidence: high.

Identifiers: CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection').

Evidence: Operator-invoked local scanner runner. Commands use argument arrays with shell=False; executable paths come from trusted local scanner installation/configuration, not an HTTP request. Environment overrides are an explicit operator trust boundary.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-9cac2da2df89 — high — false_positive

Reviewed dangerous-subprocess-use-audit audit match.

Location: `security/scanners/runtime.py:142`. Agent: B. Confidence: high.

Identifiers: CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection').

Evidence: Operator-invoked local scanner runner. Commands use argument arrays with shell=False; executable paths come from trusted local scanner installation/configuration, not an HTTP request. Environment overrides are an explicit operator trust boundary.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-0121eff9c6aa — high — false_positive

Reviewed dangerous-subprocess-use-tainted-env-args audit match.

Location: `security/scanners/runtime.py:142`. Agent: B. Confidence: high.

Identifiers: CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection').

Evidence: Operator-invoked local scanner runner. Commands use argument arrays with shell=False; executable paths come from trusted local scanner installation/configuration, not an HTTP request. Environment overrides are an explicit operator trust boundary.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-0ca1a5130391 — high — false_positive

Reviewed dangerous-subprocess-use-audit audit match.

Location: `security/scanners/secrets-scan.py:113`. Agent: B. Confidence: high.

Identifiers: CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection').

Evidence: Operator-invoked local scanner runner. Commands use argument arrays with shell=False; executable paths come from trusted local scanner installation/configuration, not an HTTP request. Environment overrides are an explicit operator trust boundary.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-69a671d1b45f — high — false_positive

Reviewed dangerous-subprocess-use-tainted-env-args audit match.

Location: `security/scanners/secrets-scan.py:113`. Agent: B. Confidence: high.

Identifiers: CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection').

Evidence: Operator-invoked local scanner runner. Commands use argument arrays with shell=False; executable paths come from trusted local scanner installation/configuration, not an HTTP request. Environment overrides are an explicit operator trust boundary.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-1d62ef60ff92 — high — false_positive

Reviewed dangerous-subprocess-use-audit audit match.

Location: `security/scanners/secrets-scan.py:141`. Agent: B. Confidence: high.

Identifiers: CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection').

Evidence: Operator-invoked local scanner runner. Commands use argument arrays with shell=False; executable paths come from trusted local scanner installation/configuration, not an HTTP request. Environment overrides are an explicit operator trust boundary.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-607e364becc4 — high — false_positive

Reviewed dangerous-subprocess-use-tainted-env-args audit match.

Location: `security/scanners/secrets-scan.py:141`. Agent: B. Confidence: high.

Identifiers: CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection').

Evidence: Operator-invoked local scanner runner. Commands use argument arrays with shell=False; executable paths come from trusted local scanner installation/configuration, not an HTTP request. Environment overrides are an explicit operator trust boundary.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-750692365824 — high — false_positive

Reviewed dangerous-subprocess-use-audit audit match.

Location: `security/scanners/secrets-test.py:61`. Agent: B. Confidence: high.

Identifiers: CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection').

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-b16b875d6b0e — high — false_positive

Reviewed dangerous-subprocess-use-audit audit match.

Location: `security/scanners/application.py:183`. Agent: B. Confidence: high.

Identifiers: CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection').

Evidence: Operator-invoked local scanner runner. Commands use argument arrays with shell=False; executable paths come from trusted local scanner installation/configuration, not an HTTP request. Environment overrides are an explicit operator trust boundary.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-7dada48068da — high — false_positive

Reviewed dangerous-subprocess-use-audit audit match.

Location: `security/scanners/application.py:205`. Agent: B. Confidence: high.

Identifiers: CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection').

Evidence: Operator-invoked local scanner runner. Commands use argument arrays with shell=False; executable paths come from trusted local scanner installation/configuration, not an HTTP request. Environment overrides are an explicit operator trust boundary.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-84c2b40fb332 — high — false_positive

Reviewed dangerous-subprocess-use-tainted-env-args audit match.

Location: `security/scanners/application.py:205`. Agent: B. Confidence: high.

Identifiers: CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection').

Evidence: Operator-invoked local scanner runner. Commands use argument arrays with shell=False; executable paths come from trusted local scanner installation/configuration, not an HTTP request. Environment overrides are an explicit operator trust boundary.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-ae8c3d2ca12e — high — false_positive

Reviewed dangerous-subprocess-use-audit audit match.

Location: `security/scanners/application.py:224`. Agent: B. Confidence: high.

Identifiers: CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection').

Evidence: Operator-invoked local scanner runner. Commands use argument arrays with shell=False; executable paths come from trusted local scanner installation/configuration, not an HTTP request. Environment overrides are an explicit operator trust boundary.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-d8dd1516663a — high — false_positive

Reviewed dangerous-subprocess-use-tainted-env-args audit match.

Location: `security/scanners/application.py:224`. Agent: B. Confidence: high.

Identifiers: CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection').

Evidence: Operator-invoked local scanner runner. Commands use argument arrays with shell=False; executable paths come from trusted local scanner installation/configuration, not an HTTP request. Environment overrides are an explicit operator trust boundary.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-e0bee5447d69 — high — false_positive

Reviewed dangerous-subprocess-use-audit audit match.

Location: `security/scanners/infrastructure.py:50`. Agent: B. Confidence: high.

Identifiers: CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection').

Evidence: Operator-invoked local scanner runner. Commands use argument arrays with shell=False; executable paths come from trusted local scanner installation/configuration, not an HTTP request. Environment overrides are an explicit operator trust boundary.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256.", "2026-10-25: repeated all 18 official Python security rule directories after generated-output exclusion changed to security/(reports|runs); same reviewed subprocess audit match, no scan errors."]

### SEC-B-ef2e41bf0a94 — high — false_positive

Reviewed js/incomplete-url-substring-sanitization audit match.

Location: `src/server/features/seo-checks/seoCheckRun.test.ts:72`. Agent: B. Confidence: high.

Identifiers: CWE-020.

Evidence: Test-only mock classifies synthetic preview responses; it is not the production origin check.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-bc2631ba4d77 — high — false_positive

Reviewed js/incomplete-url-substring-sanitization audit match.

Location: `src/server/mcp/oauth-registration.ts:51`. Agent: B. Confidence: high.

Identifiers: CWE-020.

Evidence: redirect_uris is parsed as an array of strings. Array.includes performs an exact callback-element comparison, not a URL substring check; provider redirect validation remains in the OAuth provider.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-e8efe4483156 — high — false_positive

Reviewed js/bad-tag-filter audit match.

Location: `src/server/lib/scrape.ts:111`. Agent: B. Confidence: high.

Identifiers: CWE-020, CWE-080, CWE-116, CWE-184, CWE-185, CWE-186.

Evidence: htmlToText extracts readable plain text for an LLM, not trusted HTML for innerHTML. Browser output uses escaped React/shared Markdown rendering; this is not an HTML sanitizer security boundary.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-c5c9793e25d4 — high — false_positive

Reviewed js/double-escaping audit match.

Location: `.agents/skills/evaluate-skill/scripts/report-text.mjs:7`. Agent: B. Confidence: high.

Identifiers: CWE-116, CWE-020.

Evidence: Operator-only CLI decodes report HTML into readable terminal text. The output is not treated as trusted HTML or sent to a browser rendering sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-a774603edef1 — high — false_positive

Reviewed js/double-escaping audit match.

Location: `src/server/lib/scrape.ts:123`. Agent: B. Confidence: high.

Identifiers: CWE-116, CWE-020.

Evidence: Entity decoding produces plain extracted text for model input; the result is not inserted as trusted browser HTML.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-022b782393ce — high — false_positive

Reviewed js/incomplete-multi-character-sanitization audit match.

Location: `.agents/skills/evaluate-skill/scripts/report-text.mjs:18`. Agent: B. Confidence: high.

Identifiers: CWE-020, CWE-080, CWE-116.

Evidence: Regex replacements format HTML as readable terminal text; this CLI is not an HTML sanitizer and its output is not rendered as trusted browser HTML.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-0941f42d6fb3 — high — false_positive

Reviewed js/incomplete-multi-character-sanitization audit match.

Location: `.agents/skills/evaluate-skill/scripts/report-text.mjs:23`. Agent: B. Confidence: high.

Identifiers: CWE-020, CWE-080, CWE-116.

Evidence: Regex replacements format HTML as readable terminal text; this CLI is not an HTML sanitizer and its output is not rendered as trusted browser HTML.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-347249ecfce4 — high — false_positive

Reviewed js/file-system-race audit match.

Location: `scripts/rank-location-repair-support.ts:64`. Agent: B. Confidence: high.

Identifiers: CWE-367.

Evidence: Operator-only maintenance cache under repository .cache by default; cache contents are public location metadata. The cache directory is explicitly operator-selected, not a public shared /tmp filename or network request value.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-9acb70a32e5d — high — false_positive

Reviewed js/regex/missing-regexp-anchor audit match.

Location: `tests/growth-workflow.e2e.ts:68`. Agent: B. Confidence: high.

Identifiers: CWE-020.

Evidence: End-to-end assertion on a test result, not an access-control hostname validator.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-950a7359d1b2 — high — false_positive

Reviewed js/regex/missing-regexp-anchor audit match.

Location: `vite-plugin-relay-brand.ts:147`. Agent: B. Confidence: high.

Identifiers: CWE-020.

Evidence: Build-time global source-text branding replacement intentionally matches embedded repository URLs. It is not a hostname allowlist or authorization check.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-001 — high — fixed

Asset-size probes followed redirects without revalidating the destination or rescoping preview credentials.

Location: `src/server/features/seo-checks/pageSnapshot.ts:195`. Agent: B. Confidence: high.

Identifiers: CWE-918, CWE-200.

Evidence: Local Semgrep crawler-credentials-automatic-redirect rule matched the original assetSize fetch. Before-patch regression reproduced a metadata-address redirect returning a size and a synthetic preview credential reaching a different host. No external targets or real credentials used.

Impact: A controlled asset redirect could reach an otherwise blocked host or disclose preview bypass headers to another origin.

Remediation: Use bounded manual redirects, validate each destination, recompute crawlerHeadersFor each host, and share one request deadline.

Verification: ["2026-10-25: two security regression tests failed on original code; fixed pageSnapshot+seoCheckRun suites passed 13/13.", "2026-10-25: targeted local Semgrep rule matched 1 before and 0 after; complete security rules rescan has no original-rule match."]

### DEP-2248c5c56283 — high — fixed

undici vulnerable to Denial of Service via unhandled error on excessive content-encodings

Location: `./pnpm-lock.yaml, web/pnpm-lock.yaml, tests/badseo/pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-109869, CWE-248, CWE-459, GHSA-xjj6-f33q-929c.

Evidence: ['Lockfile resolves undici@7.29.1; advisory affected range: >=7.18.0 <7.30.1.', '.>@cloudflare/vite-plugin>miniflare>undici']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 7.30.1 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-386efa3cf3c2 — high — fixed

MCP  TypeScript server SDK: Shared transport or server instances delivered one HTTP client's messages to another

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-111770, CWE-362, GHSA-jm63-cq47-j5jp.

Evidence: ['Lockfile resolves @modelcontextprotocol/server@2.0.0; advisory affected range: >=2.0.0 <2.3.0.', '.>@modelcontextprotocol/server']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 2.3.0 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-3abd08fe4018 — high — confirmed

toml-node: Uncontrolled resource consumption (CPU DoS) via unbounded-length integer literals in toml.parse()

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-114144, CWE-400, CWE-770, GHSA-9qmh-m7c6-f92p.

Evidence: ['Lockfile resolves toml@4.3.0; advisory affected range: <=5.0.0.', '.>effect>toml']

Impact: Dev-only effect CLI TOML parsing can exhaust CPU/memory on attacker-controlled local configuration. No application TOML import or remote TOML endpoint was found. The vulnerable package remains installed.

Remediation: Upgrade effect to a version using patched TOML, or backport the parser fix with compatibility tests. Do not blindly override toml 4 with 5: v5 changes integer/date values to BigInt/Temporal.

Verification: ["Lockfile path .>effect>toml and effect/src/unstable/cli/Primitive.ts confirm parser use. No repo source directly imports toml.", "Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### DEP-44710332d9ca — high — confirmed

toml-node: Quadratic-complexity DoS via many array-of-tables headers in toml.parse()

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-114141, CWE-407, GHSA-4qx8-w7c3-pj3p.

Evidence: ['Lockfile resolves toml@4.3.0; advisory affected range: <=5.0.0.', '.>effect>toml']

Impact: Dev-only effect CLI TOML parsing can exhaust CPU/memory on attacker-controlled local configuration. No application TOML import or remote TOML endpoint was found. The vulnerable package remains installed.

Remediation: Upgrade effect to a version using patched TOML, or backport the parser fix with compatibility tests. Do not blindly override toml 4 with 5: v5 changes integer/date values to BigInt/Temporal.

Verification: ["Lockfile path .>effect>toml and effect/src/unstable/cli/Primitive.ts confirm parser use. No repo source directly imports toml.", "Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### DEP-542ccd194197 — high — fixed

launch-editor: `fs.existsSync()` existence check can be bypassed on Windows

Location: `./pnpm-lock.yaml, web/pnpm-lock.yaml, tests/badseo/pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-112942, CWE-77, GHSA-587h-7wmj-h5pm.

Evidence: ['Lockfile resolves vite@7.3.6; advisory affected range: >=7.0.0 <=7.3.6.', '.>vite']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 7.3.7 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-60c77660a7b8 — high — fixed

Zod can exhaust memory while validating oversized constrained collections

Location: `web/pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2023-54404, CWE-770, GHSA-mrhx-c7xc-m3w5.

Evidence: ['Lockfile resolves zod@4.6.1; advisory affected range: <4.6.6.', '.>zod']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 4.6.6 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-63284ebf1d28 — high — fixed

launch-editor: `fs.existsSync()` existence check can be bypassed on Windows

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-112942, CWE-77, GHSA-587h-7wmj-h5pm.

Evidence: ['Lockfile resolves launch-editor@2.14.1; advisory affected range: <=2.14.1.', '.>@tanstack/devtools-vite>launch-editor']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 2.14.2 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-664222cd5e30 — high — fixed

ws: Memory exhaustion DoS from tiny fragments and data chunks

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-48779, CWE-1050, CWE-400, CWE-770, GHSA-96hv-2xvq-fx4p.

Evidence: ['Lockfile resolves ws@8.17.1; advisory affected range: >=8.0.0 <8.21.0.', '.>@trigger.dev/sdk>@trigger.dev/core>socket.io-client>engine.io-client>ws']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 8.21.0 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-6d19cad29cdb — high — fixed

DOMPurify IN_PLACE: hook that removes a parent or sibling leaves the detached subtree's event handlers armed (incomplete fix for GHSA-p98j-92pf-mc4p)

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CWE-693, CWE-79, GHSA-mrv2-3pqr-j5jr.

Evidence: ['Lockfile resolves dompurify@3.4.16; advisory affected range: <=3.4.16.', '.>posthog-js>dompurify']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 3.4.17 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-7002022a5642 — high — fixed

source-map-js allows event-loop denial of service through indexed source-map section offsets

Location: `./pnpm-lock.yaml, web/pnpm-lock.yaml, tests/badseo/pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-93749, CWE-1284, GHSA-68fv-2mgg-jv7q.

Evidence: ['Lockfile resolves source-map-js@1.2.1; advisory affected range: >=1.0.0 <1.2.2.', '.>@tailwindcss/vite>@tailwindcss/node>source-map-js', '.>vite>postcss>source-map-js']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 1.2.2 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-75436022558b — high — fixed

Zod can exhaust memory while validating oversized constrained collections

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2023-54404, CWE-770, GHSA-mrhx-c7xc-m3w5.

Evidence: ['Lockfile resolves zod@4.3.6; advisory affected range: <4.6.6.', '.>zod']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 4.6.6 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-8f3f4f895749 — high — fixed

MCP TypeScript SDK: One HTTP request within the default size limit could exhaust server memory during validation

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-111768, CWE-770, GHSA-46jr-4wx8-v453.

Evidence: ['Lockfile resolves @modelcontextprotocol/sdk@1.30.0; advisory affected range: >=1.3.0 <1.32.0.', '.>shadcn>@modelcontextprotocol/sdk', '.>@modelcontextprotocol/sdk']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 1.32.0 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-96ca5b684aae — high — fixed

MCP TypeScript SDK: Experimental tasks were not tied to the session that created them

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-111767, CWE-639, CWE-862, GHSA-22jm-h49p-29qw.

Evidence: ['Lockfile resolves @modelcontextprotocol/sdk@1.30.0; advisory affected range: >=1.24.0 <1.32.0.', '.>shadcn>@modelcontextprotocol/sdk', '.>@modelcontextprotocol/sdk']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 1.32.0 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-bd7e553ee946 — high — fixed

MCP TypeScript SDK: One HTTP request within the default size limit could exhaust server memory during validation

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-111768, CWE-770, GHSA-46jr-4wx8-v453.

Evidence: ['Lockfile resolves @modelcontextprotocol/server@2.0.0; advisory affected range: >=2.0.0 <2.3.0.', '.>@modelcontextprotocol/server']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 2.3.0 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-c5436853b71c — high — fixed

sharp : Vulnerability in librsvg dependency CVE-2026-96889

Location: `./pnpm-lock.yaml, web/pnpm-lock.yaml, tests/badseo/pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CWE-1395, CWE-416, GHSA-wq5f-xc86-pv6w.

Evidence: ['Lockfile resolves sharp@0.35.4; advisory affected range: <0.35.5.', '.>@cloudflare/vite-plugin>miniflare>sharp']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 0.35.5 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-ce6e461754e3 — high — fixed

Seroval: Memory exhaustion via unchecked TypedArray length in JSON deserialization

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-104845, CWE-770, GHSA-jp82-f5mq-hwhp.

Evidence: ['Lockfile resolves seroval@1.5.6; advisory affected range: <=1.6.2.', '.>@tanstack/react-devtools>@tanstack/devtools>solid-js>seroval']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 1.6.3 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-da81a7a36491 — high — fixed

Zod can exhaust memory while validating oversized constrained collections

Location: `./pnpm-lock.yaml, tests/badseo/pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2023-54404, CWE-770, GHSA-mrhx-c7xc-m3w5.

Evidence: ['Lockfile resolves zod@4.6.5; advisory affected range: <4.6.6.', '.>@tanstack/react-start>@tanstack/start-plugin-core>zod']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 4.6.6 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-e32b55311aa1 — high — fixed

MCP TypeScript SDK: OAuth client could send credentials to an authorization server chosen by the MCP server

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-104850, CWE-345, CWE-522, GHSA-6qxp-vccf-f47h.

Evidence: ['Lockfile resolves @modelcontextprotocol/sdk@1.30.0; advisory affected range: >=1.12.0 <1.31.0.', '.>shadcn>@modelcontextprotocol/sdk', '.>@modelcontextprotocol/sdk']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 1.31.0 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-e7df9bca0557 — high — confirmed

toml-node: Quadratic-complexity DoS via long dotted keys or table paths in toml.parse()

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-114143, CWE-407, GHSA-9j65-hcg3-gc64.

Evidence: ['Lockfile resolves toml@4.3.0; advisory affected range: <=5.0.0.', '.>effect>toml']

Impact: Dev-only effect CLI TOML parsing can exhaust CPU/memory on attacker-controlled local configuration. No application TOML import or remote TOML endpoint was found. The vulnerable package remains installed.

Remediation: Upgrade effect to a version using patched TOML, or backport the parser fix with compatibility tests. Do not blindly override toml 4 with 5: v5 changes integer/date values to BigInt/Temporal.

Verification: ["Lockfile path .>effect>toml and effect/src/unstable/cli/Primitive.ts confirm parser use. No repo source directly imports toml.", "Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### DEP-ee9f5a5519ac — high — fixed

Zod can exhaust memory while validating oversized constrained collections

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2023-54404, CWE-770, GHSA-mrhx-c7xc-m3w5.

Evidence: ['Lockfile resolves zod@3.25.76; advisory affected range: <4.6.6.', '.>shadcn>zod']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 4.6.6 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-eec87f750c3c — high — fixed

MCP TypeScript SDK: OAuth client could send credentials to an authorization server chosen by the MCP server

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-104850, CWE-345, CWE-522, GHSA-6qxp-vccf-f47h.

Evidence: ['Lockfile resolves @modelcontextprotocol/client@2.0.0; advisory affected range: >=2.0.0 <2.2.0.', '.>@modelcontextprotocol/client']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 2.2.0 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-faa1dfbaaff2 — high — fixed

Zod can exhaust memory while validating oversized constrained collections

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2023-54404, CWE-770, GHSA-mrhx-c7xc-m3w5.

Evidence: ['Lockfile resolves zod@4.4.3; advisory affected range: <4.6.6.', '.>@better-auth/api-key>zod']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 4.6.6 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-fceb9375ad7f — high — fixed

body-parser vulnerable to Denial of Service via trailing bytes after a compressed request body

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-111181, CWE-248, GHSA-27r3-jxmh-p828.

Evidence: ['Lockfile resolves body-parser@2.3.0; advisory affected range: >=2.0.0 <2.4.0.', '.>shadcn>@modelcontextprotocol/sdk>express>body-parser']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 2.4.0 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### INFRA-2C5D7AC4377A — high — unverified

util-linux: util-linux: TOCTOU in the mount program via ancestor directory swap on target path

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-53613, CWE-367.

Evidence: Scanner matched bsdutils@1:2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-B6F794EEFDB9 — high — unverified

util-linux: util-linux: Partition metadata compromise via integer overflow in DOS partition parser

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-53615, CWE-190.

Evidence: Scanner matched bsdutils@1:2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-6BF688812DF0 — high — unverified

util-linux: util-linux: failed external mount helper still runs privileged X-mount post-hooks

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-76642, CWE-390.

Evidence: Scanner matched bsdutils@1:2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-8BC536035669 — high — unverified

util-linux: util-linux: nsenter --join-cgroup leaks root cgroup migration authority

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78408, CWE-775.

Evidence: Scanner matched bsdutils@1:2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-E766293FDA8A — high — unverified

util-linux: util-linux: X-mount.subdir detached-tree resolution can escape via intermediate symlinks

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78409, CWE-59.

Evidence: Scanner matched bsdutils@1:2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-98D01F270321 — high — unverified

util-linux: util-linux: restricted bind mounts do not pin the source, allowing X-mount.owner/group/mode redirection

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78410, CWE-367.

Evidence: Scanner matched bsdutils@1:2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-5F40894D7FBC — high — unverified

gzip: gzip: Information disclosure via global buffer overflow in LZH decompression

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-41992, CWE-126.

Evidence: Scanner matched gzip@1.12-1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-657BC563D517 — high — unverified

acl: Symlink traversal privilege escalation via libacl functions

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-54369, CWE-59.

Evidence: Scanner matched libacl1@2.3.1-3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-47A0C07FC567 — high — unverified

util-linux: util-linux: TOCTOU in the mount program via ancestor directory swap on target path

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-53613, CWE-367.

Evidence: Scanner matched libblkid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-0346DEC00969 — high — unverified

util-linux: util-linux: Partition metadata compromise via integer overflow in DOS partition parser

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-53615, CWE-190.

Evidence: Scanner matched libblkid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-3AA4DE5850AB — high — unverified

util-linux: util-linux: failed external mount helper still runs privileged X-mount post-hooks

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-76642, CWE-390.

Evidence: Scanner matched libblkid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-63FCAF6662FD — high — unverified

util-linux: util-linux: nsenter --join-cgroup leaks root cgroup migration authority

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78408, CWE-775.

Evidence: Scanner matched libblkid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-BE6CE6043588 — high — unverified

util-linux: util-linux: X-mount.subdir detached-tree resolution can escape via intermediate symlinks

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78409, CWE-59.

Evidence: Scanner matched libblkid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-379EC20F3D5D — high — unverified

util-linux: util-linux: restricted bind mounts do not pin the source, allowing X-mount.owner/group/mode redirection

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78410, CWE-367.

Evidence: Scanner matched libblkid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-86B980104D9A — high — unverified

util-linux: util-linux: TOCTOU in the mount program via ancestor directory swap on target path

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-53613, CWE-367.

Evidence: Scanner matched libmount1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-166E63B63397 — high — unverified

util-linux: util-linux: Partition metadata compromise via integer overflow in DOS partition parser

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-53615, CWE-190.

Evidence: Scanner matched libmount1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-49CF5A750AEA — high — unverified

util-linux: util-linux: failed external mount helper still runs privileged X-mount post-hooks

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-76642, CWE-390.

Evidence: Scanner matched libmount1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-DA91902C87C4 — high — unverified

util-linux: util-linux: nsenter --join-cgroup leaks root cgroup migration authority

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78408, CWE-775.

Evidence: Scanner matched libmount1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-44CAA73F901B — high — unverified

util-linux: util-linux: X-mount.subdir detached-tree resolution can escape via intermediate symlinks

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78409, CWE-59.

Evidence: Scanner matched libmount1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-1AB39B410E09 — high — unverified

util-linux: util-linux: restricted bind mounts do not pin the source, allowing X-mount.owner/group/mode redirection

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78410, CWE-367.

Evidence: Scanner matched libmount1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-F4EDB31B0496 — high — unverified

util-linux: util-linux: TOCTOU in the mount program via ancestor directory swap on target path

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-53613, CWE-367.

Evidence: Scanner matched libsmartcols1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-357BE2D7C7C2 — high — unverified

util-linux: util-linux: Partition metadata compromise via integer overflow in DOS partition parser

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-53615, CWE-190.

Evidence: Scanner matched libsmartcols1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-4DF55409D6FA — high — unverified

util-linux: util-linux: failed external mount helper still runs privileged X-mount post-hooks

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-76642, CWE-390.

Evidence: Scanner matched libsmartcols1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-9083A77F59BC — high — unverified

util-linux: util-linux: nsenter --join-cgroup leaks root cgroup migration authority

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78408, CWE-775.

Evidence: Scanner matched libsmartcols1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-95136124B426 — high — unverified

util-linux: util-linux: X-mount.subdir detached-tree resolution can escape via intermediate symlinks

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78409, CWE-59.

Evidence: Scanner matched libsmartcols1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-4F2C88444E5D — high — unverified

util-linux: util-linux: restricted bind mounts do not pin the source, allowing X-mount.owner/group/mode redirection

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78410, CWE-367.

Evidence: Scanner matched libsmartcols1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-972D22A7050A — high — unverified

openssl: compat-openssl: openssl: Information disclosure via DTLS handshake retransmission

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-84782, CWE-125.

Evidence: Scanner matched libssl3@3.0.22-1~deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-54FBABF7F177 — high — unverified

systemd: systemd-homed: Local privilege escalation via missing home-record signature verification

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-16742, CWE-269, CWE-347.

Evidence: Scanner matched libsystemd0@252.39-1~deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-0981F7F4B8F5 — high — unverified

ncurses: ncurses: Buffer overflow vulnerability may lead to arbitrary code execution.

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-69720, CWE-121, CWE-120.

Evidence: Scanner matched libtinfo6@6.4-4 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-E2241E845569 — high — unverified

systemd: systemd-homed: Local privilege escalation via missing home-record signature verification

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-16742, CWE-269, CWE-347.

Evidence: Scanner matched libudev1@252.39-1~deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-2D5CADC96880 — high — unverified

util-linux: util-linux: TOCTOU in the mount program via ancestor directory swap on target path

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-53613, CWE-367.

Evidence: Scanner matched libuuid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-C9451181740A — high — unverified

util-linux: util-linux: Partition metadata compromise via integer overflow in DOS partition parser

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-53615, CWE-190.

Evidence: Scanner matched libuuid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-AE369801D7F7 — high — unverified

util-linux: util-linux: failed external mount helper still runs privileged X-mount post-hooks

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-76642, CWE-390.

Evidence: Scanner matched libuuid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-839427C527CA — high — unverified

util-linux: util-linux: nsenter --join-cgroup leaks root cgroup migration authority

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78408, CWE-775.

Evidence: Scanner matched libuuid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-D724AC8FC913 — high — unverified

util-linux: util-linux: X-mount.subdir detached-tree resolution can escape via intermediate symlinks

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78409, CWE-59.

Evidence: Scanner matched libuuid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-91D356A699CB — high — unverified

util-linux: util-linux: restricted bind mounts do not pin the source, allowing X-mount.owner/group/mode redirection

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78410, CWE-367.

Evidence: Scanner matched libuuid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-20722F69BC41 — high — unverified

util-linux: util-linux: TOCTOU in the mount program via ancestor directory swap on target path

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-53613, CWE-367.

Evidence: Scanner matched mount@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-C11F5E01470C — high — unverified

util-linux: util-linux: Partition metadata compromise via integer overflow in DOS partition parser

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-53615, CWE-190.

Evidence: Scanner matched mount@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-4E23E4C66895 — high — unverified

util-linux: util-linux: failed external mount helper still runs privileged X-mount post-hooks

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-76642, CWE-390.

Evidence: Scanner matched mount@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-6C4F59FB8A94 — high — unverified

util-linux: util-linux: nsenter --join-cgroup leaks root cgroup migration authority

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78408, CWE-775.

Evidence: Scanner matched mount@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-20CDF2244AAE — high — unverified

util-linux: util-linux: X-mount.subdir detached-tree resolution can escape via intermediate symlinks

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78409, CWE-59.

Evidence: Scanner matched mount@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-44CCE77FEECD — high — unverified

util-linux: util-linux: restricted bind mounts do not pin the source, allowing X-mount.owner/group/mode redirection

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78410, CWE-367.

Evidence: Scanner matched mount@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-874FF2E3F5C6 — high — unverified

ncurses: ncurses: Buffer overflow vulnerability may lead to arbitrary code execution.

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-69720, CWE-121, CWE-120.

Evidence: Scanner matched ncurses-base@6.4-4 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-491883407BD0 — high — unverified

ncurses: ncurses: Buffer overflow vulnerability may lead to arbitrary code execution.

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-69720, CWE-121, CWE-120.

Evidence: Scanner matched ncurses-bin@6.4-4 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-55685C8D42EB — high — unverified

openssl: compat-openssl: openssl: Information disclosure via DTLS handshake retransmission

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-84782, CWE-125.

Evidence: Scanner matched openssl@3.0.22-1~deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-3E61884D0B58 — high — unverified

perl-Archive-Tar: perl-Archive-Tar: Denial of Service via crafted tar header with large entry size

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-9538, CWE-789.

Evidence: Scanner matched perl-base@5.36.0-7+deb12u4 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-AF2EFFC93E08 — unknown — unverified

Pod::Text versions before 6.1.1 for Perl allow CPU and memory exhausti ...

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-82560, CWE-835.

Evidence: Scanner matched perl-base@5.36.0-7+deb12u4 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-42EC7F152BDC — high — unverified

util-linux: util-linux: TOCTOU in the mount program via ancestor directory swap on target path

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-53613, CWE-367.

Evidence: Scanner matched util-linux@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-00B9E6392153 — high — unverified

util-linux: util-linux: Partition metadata compromise via integer overflow in DOS partition parser

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-53615, CWE-190.

Evidence: Scanner matched util-linux@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-1DB18A650032 — high — unverified

util-linux: util-linux: failed external mount helper still runs privileged X-mount post-hooks

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-76642, CWE-390.

Evidence: Scanner matched util-linux@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-86859DBAE844 — high — unverified

util-linux: util-linux: nsenter --join-cgroup leaks root cgroup migration authority

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78408, CWE-775.

Evidence: Scanner matched util-linux@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-FA81A9FD6AAC — high — unverified

util-linux: util-linux: X-mount.subdir detached-tree resolution can escape via intermediate symlinks

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78409, CWE-59.

Evidence: Scanner matched util-linux@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-0EAA0A674A8F — high — unverified

util-linux: util-linux: restricted bind mounts do not pin the source, allowing X-mount.owner/group/mode redirection

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78410, CWE-367.

Evidence: Scanner matched util-linux@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-539325C9D89C — high — unverified

util-linux: util-linux: TOCTOU in the mount program via ancestor directory swap on target path

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-53613, CWE-367.

Evidence: Scanner matched util-linux-extra@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-B8CB77A51F28 — high — unverified

util-linux: util-linux: Partition metadata compromise via integer overflow in DOS partition parser

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-53615, CWE-190.

Evidence: Scanner matched util-linux-extra@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-D55CAD16E417 — high — unverified

util-linux: util-linux: failed external mount helper still runs privileged X-mount post-hooks

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-76642, CWE-390.

Evidence: Scanner matched util-linux-extra@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-CB77EACA3154 — high — unverified

util-linux: util-linux: nsenter --join-cgroup leaks root cgroup migration authority

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78408, CWE-775.

Evidence: Scanner matched util-linux-extra@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-FEEFE2C50A84 — high — unverified

util-linux: util-linux: X-mount.subdir detached-tree resolution can escape via intermediate symlinks

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78409, CWE-59.

Evidence: Scanner matched util-linux-extra@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-B0CAC4A6DB6A — high — unverified

util-linux: util-linux: restricted bind mounts do not pin the source, allowing X-mount.owner/group/mode redirection

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78410, CWE-367.

Evidence: Scanner matched util-linux-extra@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-81606342B66A — high — unverified

undici: undici: Denial of Service via unhandled stream error on excessive content encodings

Location: `image:Node.js`. Agent: D. Confidence: high.

Identifiers: CVE-2026-109869, CWE-248, CWE-459.

Evidence: Scanner matched undici@6.29.0 against its vulnerability database.

Impact: The affected package is bundled inside the global npm CLI. It is not the application lockfile copy, and application HTTP reachability is unverified.

Remediation: Request patched bundled dependencies from npm, or maintain and test a focused vendor patch. npm12.2.1 official tarball was also inspected and still bundles ip-address10.7.2 and undici6.29.0, so another major bump does not resolve these detections.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "Official npm12.2.1 registry tarball package.json versions independently inspected; same vulnerable bundled versions remain."]

### INFRA-51C00D465183 — unknown — unverified

Invoking integer overflow in NewNTUnicodeString in golang.org/x/sys/windows

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-39824, CWE-190.

Evidence: Scanner matched golang.org/x/sys@v0.0.0-20220715151400-c0bba94af5f8 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-066EB68D8493 — high — unverified

golang: net/url: Memory exhaustion in query parameter parsing in net/url

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2025-61726, CWE-770.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-D3E999C51F42 — high — unverified

crypto/x509: golang: Denial of Service due to excessive resource consumption via crafted certificate

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2025-61729, CWE-295.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-86E98F33BF96 — high — unverified

crypto/x509: golang: crypto/x509: Man-in-the-middle attacks via untrusted intermediate certificates

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-111943.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-53E61DCFA225 — high — unverified

net/url: Incorrect parsing of IPv6 host literals in net/url

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-25679, CWE-425, CWE-1286.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-8F09B3E6C94E — high — unverified

crypto/x509: golang: golang crypto/x509: Denial of Service via excessive processing of DNS SAN entries

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-27145, CWE-606.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-07F1F9481429 — high — unverified

crypto/x509: crypto/tls: golang: Go: Denial of Service vulnerability in certificate chain building

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-32280, CWE-770.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-890C8D40299D — high — unverified

crypto/x509: golang: Go crypto/x509: Denial of Service via inefficient certificate chain validation

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-32281, CWE-295.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-A13B34AE91DA — high — unverified

crypto/tls: golang: Go crypto/tls: Denial of Service via multiple TLS 1.3 key update messages

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-32283, CWE-770, CWE-764.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-D550C16BB779 — high — unverified

net: golang: Go net package: Denial of Service via long CNAME response in LookupCNAME

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-33811, CWE-415, CWE-1341.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-119ADF57B7C8 — high — unverified

net/http/internal/http2: golang: golang.org/x/net: Go HTTP/2: Denial of Service via malformed SETTINGS_MAX_FRAME_SIZE frame

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-33814, CWE-835, CWE-606.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-25E4D188C508 — high — unverified

encoding/asn1: golang: Go encoding/asn1: Denial of Service via excessive recursion in Unmarshal

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-33818, CWE-400.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-3BC1CEF5BE13 — high — unverified

net/mail: golang: Go net/mail: Denial of Service via crafted email inputs

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-39820, CWE-770, CWE-606.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-7F13B97DA15F — high — unverified

golang.org/x/net/idna: golang: net/http: golang.org/x/net/idna: Privilege escalation via incorrect Punycode label processing

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-39821, CWE-1289.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-7F6901CF2B09 — high — unverified

golang: Go os.Root: Symlink following vulnerability allows directory traversal

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-39822, CWE-61.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-AE265FCEC8CC — high — unverified

net: golang: Go net package: Denial of Service via NUL byte in Dial and LookupPort on Windows

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-39836, CWE-476.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-DD9B6126767B — high — unverified

net/mail: golang: net/mail: Denial of Service via pathological email address parsing

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-42499, CWE-1046.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-EA8F3F9987CA — high — unverified

mime: golang: Golang MIME: Denial of Service via maliciously-crafted MIME header

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-42504, CWE-407.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-654FDE372DE6 — high — unverified

net/http: golang: Go net/http: Unencrypted HTTP/2 connections vulnerable to Denial of Service

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56853, CWE-770.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-66616A121F3E — high — unverified

html/template: golang: Go html/template: Cross-Site Scripting via pathological input

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56858, CWE-79.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-EEB6F055F633 — high — unverified

encoding/xml: golang: Go: Denial of Service via XML decoding recursion depth issue

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56859, CWE-770.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-698C3EB0B2CE — high — unverified

net/url: golang: golang net/url: Denial of Service from quadratic complexity in path resolution

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56860, CWE-407.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-89945F590153 — high — unverified

crypto/tls: golang: Golang crypto/tls: Denial of Service via indefinite KeyUpdate messages

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56862, CWE-770.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-E86515F86815 — high — unverified

net/http: golang: golang: Denial of Service via crafted HTTP Range headers

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78667, CWE-770.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-C9DC7267BCD1 — high — unverified

net/http: net/http/internal/http2: golang.org/x/net/http2: net/http: Denial of Service via excessive HTTP/2 SETTINGS frames

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78669, CWE-405.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-318D975B96F7 — high — unverified

crypto/tls: golang: crypto/tls: Denial of Service via multiple ECH outer extension references

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-97031, CWE-405.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-D5F8A0384AE9 — high — unverified

golang.org/x/text: golang.org/x/text: Denial of Service via out-of-bounds slice error in Nickname profile

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56851, CWE-787.

Evidence: Scanner matched golang.org/x/text@v0.34.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-B4283911BA7D — high — unverified

golang.org/x/text: golang.org/x/text: Denial of Service via invalid UTF-8 input

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56852, CWE-835.

Evidence: Scanner matched golang.org/x/text@v0.34.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-2C4DF4D9420F — high — unverified

crypto/x509: golang: crypto/x509: Man-in-the-middle attacks via untrusted intermediate certificates

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-111943.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-7DEE0DEA570E — high — unverified

net/url: Incorrect parsing of IPv6 host literals in net/url

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-25679, CWE-425, CWE-1286.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-E25992C9ED54 — high — unverified

crypto/x509: Incorrect enforcement of email constraints in crypto/x509

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-27137, CWE-295.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-B7BF4EC03C73 — high — unverified

crypto/x509: golang: golang crypto/x509: Denial of Service via excessive processing of DNS SAN entries

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-27145, CWE-606.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-D41887099D91 — high — unverified

crypto/x509: crypto/tls: golang: Go: Denial of Service vulnerability in certificate chain building

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-32280, CWE-770.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-8BFCF0BB5CB8 — high — unverified

crypto/x509: golang: Go crypto/x509: Denial of Service via inefficient certificate chain validation

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-32281, CWE-295.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-13021C41ADC3 — high — unverified

crypto/tls: golang: Go crypto/tls: Denial of Service via multiple TLS 1.3 key update messages

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-32283, CWE-770, CWE-764.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-1C9E81BEB322 — high — unverified

crypto/x509: golang: Go crypto/x509: Certificate validation bypass due to incorrect DNS constraint application

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-33810, CWE-295, CWE-1289.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-5C6D18A7835E — high — unverified

net: golang: Go net package: Denial of Service via long CNAME response in LookupCNAME

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-33811, CWE-415, CWE-1341.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-9E3990217FA6 — high — unverified

net/http/internal/http2: golang: golang.org/x/net: Go HTTP/2: Denial of Service via malformed SETTINGS_MAX_FRAME_SIZE frame

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-33814, CWE-835, CWE-606.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-C6B4C4B1190F — high — unverified

encoding/asn1: golang: Go encoding/asn1: Denial of Service via excessive recursion in Unmarshal

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-33818, CWE-400.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-BA0FDBE3B404 — high — unverified

net/mail: golang: Go net/mail: Denial of Service via crafted email inputs

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-39820, CWE-770, CWE-606.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-5FFD52F6F72D — high — unverified

golang.org/x/net/idna: golang: net/http: golang.org/x/net/idna: Privilege escalation via incorrect Punycode label processing

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-39821, CWE-1289.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-D731BCE45C18 — high — unverified

golang: Go os.Root: Symlink following vulnerability allows directory traversal

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-39822, CWE-61.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-511B0DE612F1 — high — unverified

net: golang: Go net package: Denial of Service via NUL byte in Dial and LookupPort on Windows

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-39836, CWE-476.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-6BB530C87D7B — high — unverified

net/mail: golang: net/mail: Denial of Service via pathological email address parsing

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-42499, CWE-1046.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-F407F7DFD2C3 — high — unverified

mime: golang: Golang MIME: Denial of Service via maliciously-crafted MIME header

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-42504, CWE-407.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-1E45DD865247 — high — unverified

golang.org/x/net/dns/dnsmessage: golang.org/x/net/dns/dnsmessage: Denial of Service via invalid DNS record parsing

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-46600, CWE-125.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-17C8217E049C — high — unverified

net/http: golang: Go net/http: Unencrypted HTTP/2 connections vulnerable to Denial of Service

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56853, CWE-770.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-CBF7DB73F01B — high — unverified

html/template: golang: Go html/template: Cross-Site Scripting via pathological input

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56858, CWE-79.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-DFBE723C95D4 — high — unverified

encoding/xml: golang: Go: Denial of Service via XML decoding recursion depth issue

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56859, CWE-770.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-09ECA30066C3 — high — unverified

net/url: golang: golang net/url: Denial of Service from quadratic complexity in path resolution

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56860, CWE-407.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-7981AA36969A — high — unverified

crypto/tls: golang: Golang crypto/tls: Denial of Service via indefinite KeyUpdate messages

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56862, CWE-770.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-C9B697770047 — high — unverified

net/http: golang: golang: Denial of Service via crafted HTTP Range headers

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78667, CWE-770.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-D6D889EF9601 — high — unverified

net/http: net/http/internal/http2: golang.org/x/net/http2: net/http: Denial of Service via excessive HTTP/2 SETTINGS frames

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78669, CWE-405.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-789B40BE9263 — high — unverified

crypto/tls: golang: crypto/tls: Denial of Service via multiple ECH outer extension references

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-97031, CWE-405.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-DOCKER-CONTEXT-SECRETS — high — fixed

Wrangler .dev.vars credentials were included by COPY . . in self-host Docker images.

Location: `deploy/docker/Dockerfile.dockerignore`. Agent: D. Confidence: high.

Identifiers: CWE-538, CWE-200.

Evidence: Before the fix, an actual scratch Docker build using the repository ignore rules exported a synthetic .dev.vars file into its image. No real credential file was inspected or copied by this test.

Impact: Anyone able to read a locally built/published image could recover credentials from .dev.vars files present in the build context.

Remediation: Exclude root and nested .dev.vars and environment variants from Docker contexts. If previous images were built with real secret files present, rotate the affected credentials and retire those images; removing files from a later image cannot revoke credentials.

Verification: ["Before: synthetic Docker build exit0; exported .dev.vars exists=true.", "Regression harness against HEAD Docker ignore rules failed with exit1; the same harness against patched rules passed with exit0.", "After: python3 security/scanners/infrastructure-context-test.py passed;8 root/nested credential paths excluded;3 application/example files retained.", "No claim is made that an existing published image contained credentials; rotation is conditional on historical image exposure."]

### INFRA-IMAGE-PACKAGE-EXPOSURE — high — fixed

Removed unnecessary buildpack image packages and updated bundled package managers; remaining image advisories are tracked individually.

Location: `deploy/docker/Dockerfile`. Agent: D. Confidence: high.

Identifiers: CWE-1395.

Evidence: Same repository image: Debian package inventory413→91 and OS advisory records4575→242; npm advisory records70→6; embedded Go records109→109. Raw total4754→357. This is a scanner-record reduction, not a count of proven exploitable application vulnerabilities.

Impact: The full Node image included unused compilers, image decoders and database clients, plus outdated pnpm/npm dependencies, increasing the number of vulnerable components distributed to self-hosters.

Remediation: Use Node22 Bookworm slim with an explicit CA bundle and signed distro updates; retain compatible patched package-manager pins and rescan regularly. Follow the separate residual records for unresolved advisories.

Verification: ["Before: infrastructure-image-before.json, original full imagee22a0ae2aebc... .", "After: infrastructure-trivy-image.json from sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff.", "Cold start, migrations, Vite build, TypeScript check, CA bundle and database health passed; restart preserved disposable DB state and passed health again.", "Verified Node22.23.4, pnpm10.34.8, npm11.21.1; no real credentials or external provider calls were used."]

### SEC-B-56ac680225e4 — medium — false_positive

Reviewed detect-redos audit match.

Location: `deploy/alchemy/alchemy.run.ts:332`. Agent: B. Confidence: high.

Identifiers: CWE-1333: Inefficient Regular Expression Complexity.

Evidence: The hostname expression separates repeated labels with literal dots outside the label character class; it has no overlapping nested repetition. Alchemy input is also operator configuration.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-81383b1e3b6b — medium — false_positive

Reviewed react-href-var audit match.

Location: `src/client/features/ai-search/components/PromptExplorerResults.tsx:152`. Agent: B. Confidence: high.

Identifiers: CWE-79: Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting').

Evidence: Citation extraction calls safeHttpUrl before constructing stored/returned citations; it rejects non-http(s) schemes and embedded credentials. The component renders only that normalized citation model.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-484679aa8f3a — medium — false_positive

Reviewed jquery-insecure-selector audit match.

Location: `src/client/features/backlinks/BacklinksTable.test.ts:26`. Agent: B. Confidence: high.

Identifiers: CWE-79: Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting').

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-2bc4c47a2b9d — medium — false_positive

Reviewed unsafe-dynamic-method audit match.

Location: `src/client/features/integrations/startGoogleLink.ts:55`. Agent: B. Confidence: high.

Identifiers: CWE-94: Improper Control of Generation of Code ('Code Injection').

Evidence: Lookup key is the closed UI provider union (gsc/ga4); values are fixed imported server-function references.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-d11f402b9e60 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/client/lib/clipboard.ts:45`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Clipboard table headers/cells pass escapeHtml; hyperlinks additionally require safeHttpUrl before attribute escaping. The rule cannot follow these project-specific escaping helpers.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-4f974feed7ec — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/client/lib/clipboard.ts:46`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Clipboard table headers/cells pass escapeHtml; hyperlinks additionally require safeHttpUrl before attribute escaping. The rule cannot follow these project-specific escaping helpers.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-a7ebf1833d9e — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/client/lib/clipboard.ts:49`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Clipboard table headers/cells pass escapeHtml; hyperlinks additionally require safeHttpUrl before attribute escaping. The rule cannot follow these project-specific escaping helpers.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-ac82abf58aed — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/client/lib/clipboard.ts:52`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Clipboard table headers/cells pass escapeHtml; hyperlinks additionally require safeHttpUrl before attribute escaping. The rule cannot follow these project-specific escaping helpers.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-785a665587e4 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/client/lib/clipboard.ts:60`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Clipboard table headers/cells pass escapeHtml; hyperlinks additionally require safeHttpUrl before attribute escaping. The rule cannot follow these project-specific escaping helpers.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-c502be2e852a — medium — false_positive

Reviewed unsafe-dynamic-method audit match.

Location: `src/lib/auth.ts:160`. Agent: B. Confidence: high.

Identifiers: CWE-94: Improper Control of Generation of Code ('Code Injection').

Evidence: Dynamic console method is chosen from Better Auth log levels and a local debug-to-log mapping; it cannot select an arbitrary application method.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-3d4e1f0e8539 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/routes/sitemap[.]xml.ts:17`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Sitemap values come from fixed Relay origin plus repository-authored documentation route metadata, not request parameters or customer text.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-89542bbe90ca — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/email/relay-email.ts:34`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Dynamic email text and link attributes pass escapeHtml. Invitation and digest link origins/paths are server-generated.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-c8156d95ae25 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/features/accessibility/AccessibilityCheckService.test.ts:72`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-f7bcb897254d — medium — false_positive

Reviewed raw-html-join audit match.

Location: `src/server/features/accessibility/AltTextDraftService.ts:112`. Agent: B. Confidence: high.

Identifiers: CWE-79: Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting').

Evidence: The joined string is an LLM input prompt passed to the structured drafting service, not an HTML/DOM rendering sink. The flagged rule concerns browser HTML injection.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-61ae77d3716a — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/features/accessibility/accessibilityStep.test.ts:150`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-b1a3bb9f96dc — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/features/accessibility/accessibilityStep.test.ts:195`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-47e9f150a2ea — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/features/accessibility/axeRun.test.ts:70`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-081cfd2917b3 — medium — false_positive

Reviewed detect-non-literal-regexp audit match.

Location: `src/server/features/ai-search/services/promptExplorer.ts:327`. Agent: B. Confidence: high.

Identifiers: CWE-1333: Inefficient Regular Expression Complexity.

Evidence: Every variable fragment escapes regex metacharacters before interpolation. Surrounding boundary assertions are fixed source code; these calls do not execute user-provided regex syntax.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-1a5774f96776 — medium — false_positive

Reviewed detect-non-literal-regexp audit match.

Location: `src/server/features/ai-visibility/services/aiVisibilityMatching.ts:44`. Agent: B. Confidence: high.

Identifiers: CWE-1333: Inefficient Regular Expression Complexity.

Evidence: Every variable fragment escapes regex metacharacters before interpolation. Surrounding boundary assertions are fixed source code; these calls do not execute user-provided regex syntax.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-e58c7f2d5d7d — medium — false_positive

Reviewed detect-non-literal-regexp audit match.

Location: `src/server/features/ai-visibility/services/aiVisibilityMatching.ts:112`. Agent: B. Confidence: high.

Identifiers: CWE-1333: Inefficient Regular Expression Complexity.

Evidence: Every variable fragment escapes regex metacharacters before interpolation. Surrounding boundary assertions are fixed source code; these calls do not execute user-provided regex syntax.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-7ab96aaaaadf — medium — false_positive

Reviewed raw-html-join audit match.

Location: `src/server/features/conversion/CopyDraftService.ts:102`. Agent: B. Confidence: high.

Identifiers: CWE-79: Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting').

Evidence: The joined string is an LLM input prompt passed to the structured drafting service, not an HTML/DOM rendering sink. The flagged rule concerns browser HTML injection.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-2c33c7dd84ea — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/features/conversion/CopyDraftService.ts:104`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: XML-like delimiters are sent as plain LLM prompt text, not rendered as browser HTML.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-fe9b1ca35102 — medium — false_positive

Reviewed detect-non-literal-regexp audit match.

Location: `src/server/features/conversion/copyDraftChecks.ts:79`. Agent: B. Confidence: high.

Identifiers: CWE-1333: Inefficient Regular Expression Complexity.

Evidence: Every variable fragment escapes regex metacharacters before interpolation. Surrounding boundary assertions are fixed source code; these calls do not execute user-provided regex syntax.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-34ad443d6ac7 — medium — false_positive

Reviewed unsafe-dynamic-method audit match.

Location: `src/server/features/docs/DocsDraftService.ts:148`. Agent: B. Confidence: high.

Identifiers: CWE-94: Improper Control of Generation of Code ('Code Injection').

Evidence: input.kind is validated by the documentation draft discriminated union, selecting a fixed formatter from WHAT.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-be3f59b17615 — medium — false_positive

Reviewed raw-html-join audit match.

Location: `src/server/features/docs/DocsDraftService.ts:156`. Agent: B. Confidence: high.

Identifiers: CWE-79: Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting').

Evidence: The joined string is an LLM input prompt passed to the structured drafting service, not an HTML/DOM rendering sink. The flagged rule concerns browser HTML injection.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-4a1900e580d8 — medium — false_positive

Reviewed unsafe-dynamic-method audit match.

Location: `src/server/features/growth/GrowthJobService.ts:189`. Agent: B. Confidence: high.

Identifiers: CWE-94: Improper Control of Generation of Code ('Code Injection').

Evidence: kind is a validated growth-job kind from the authorized schedule/workflow; GROWTH_JOBS is a fixed dispatcher with a missing-job guard.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-485b723c4402 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/features/growth/emailDigest.ts:117`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Dynamic email text and link attributes pass escapeHtml. Invitation and digest link origins/paths are server-generated.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-bf1277e73495 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/features/growth/emailDigest.ts:120`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Dynamic email text and link attributes pass escapeHtml. Invitation and digest link origins/paths are server-generated.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-ca4ebb039404 — medium — false_positive

Reviewed raw-html-join audit match.

Location: `src/server/features/opportunities/services/ContentBriefService.ts:147`. Agent: B. Confidence: high.

Identifiers: CWE-79: Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting').

Evidence: The joined string is an LLM input prompt passed to the structured drafting service, not an HTML/DOM rendering sink. The flagged rule concerns browser HTML injection.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-d25bf708e685 — medium — false_positive

Reviewed unsafe-dynamic-method audit match.

Location: `src/server/features/opportunities/services/OpportunityService.test.ts:135`. Agent: B. Confidence: high.

Identifiers: CWE-94: Improper Control of Generation of Code ('Code Injection').

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-ad7e68d31c14 — medium — false_positive

Reviewed detect-non-literal-regexp audit match.

Location: `src/server/features/opportunities/services/detectors/shared.ts:155`. Agent: B. Confidence: high.

Identifiers: CWE-1333: Inefficient Regular Expression Complexity.

Evidence: Every variable fragment escapes regex metacharacters before interpolation. Surrounding boundary assertions are fixed source code; these calls do not execute user-provided regex syntax.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-66139c58a4d9 — medium — false_positive

Reviewed unsafe-dynamic-method audit match.

Location: `src/server/features/publishing/PublishingConnectionService.test.ts:94`. Agent: B. Confidence: high.

Identifiers: CWE-94: Improper Control of Generation of Code ('Code Injection').

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-7f199c1fc388 — medium — false_positive

Reviewed raw-html-join audit match.

Location: `src/server/features/publishing/anchorDraft.ts:74`. Agent: B. Confidence: high.

Identifiers: CWE-79: Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting').

Evidence: The joined string is an LLM input prompt passed to the structured drafting service, not an HTML/DOM rendering sink. The flagged rule concerns browser HTML injection.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-97ad295d8fa3 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/features/publishing/anchorDraft.ts:76`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: XML-like delimiters are sent as plain LLM prompt text, not rendered as browser HTML.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-6db35a42f1bc — medium — false_positive

Reviewed detect-non-literal-regexp audit match.

Location: `src/server/features/publishing/draftChecks.ts:59`. Agent: B. Confidence: high.

Identifiers: CWE-1333: Inefficient Regular Expression Complexity.

Evidence: Every variable fragment escapes regex metacharacters before interpolation. Surrounding boundary assertions are fixed source code; these calls do not execute user-provided regex syntax.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-94d991a2584e — medium — false_positive

Reviewed raw-html-join audit match.

Location: `src/server/features/publishing/draftInputs.ts:153`. Agent: B. Confidence: high.

Identifiers: CWE-79: Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting').

Evidence: The joined string is an LLM input prompt passed to the structured drafting service, not an HTML/DOM rendering sink. The flagged rule concerns browser HTML injection.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-0a36f2c42598 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/features/publishing/pageTexts.test.ts:11`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-84dbc3f58ac6 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/features/publishing/pagesRouterHead.test.ts:5`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-ec16df8b7af3 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/features/reports/reportRoute.test.ts:80`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-e4fdd0839ef6 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/features/reports/reportRoute.test.ts:104`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-58c140290226 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/features/reports/sharePage.test.ts:47`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-28d7a42aa085 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/features/reports/sharePage.test.ts:56`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-a95f50924689 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/features/seo-checks/seoCheckRun.test.ts:62`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-f77b855059ed — medium — false_positive

Reviewed detect-non-literal-regexp audit match.

Location: `src/server/features/seo-checks/urlSelection.ts:60`. Agent: B. Confidence: high.

Identifiers: CWE-1333: Inefficient Regular Expression Complexity.

Evidence: Patterns are derived from route file segments, metacharacters are escaped, and each dynamic segment becomes a non-slash character class separated by a literal slash. This is not evaluation of arbitrary regex syntax.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-e874c29d2afd — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/features/split-tests/SplitTestService.test.ts:74`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-8db6ab16f898 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/features/split-tests/splitTestRefresh.test.ts:58`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-2e506d3dc10b — medium — false_positive

Reviewed detect-non-literal-regexp audit match.

Location: `src/server/features/support/redact.ts:23`. Agent: B. Confidence: high.

Identifiers: CWE-1333: Inefficient Regular Expression Complexity.

Evidence: Every variable fragment escapes regex metacharacters before interpolation. Surrounding boundary assertions are fixed source code; these calls do not execute user-provided regex syntax.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-3f608380ea96 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/lib/audit/discovery.test.ts:5`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-2c3e804abc6b — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/lib/audit/discovery.test.ts:6`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-27321ada307e — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/lib/audit/page-analyzer.test.ts:213`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-2cb68fd055ba — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/lib/audit/page-analyzer.test.ts:234`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-da850429cee2 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/lib/audit/page-analyzer.test.ts:238`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-e75c5e613030 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/lib/audit/page-analyzer.test.ts:241`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-dddd908bcff8 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/lib/audit/page-analyzer.test.ts:257`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-f9802dcc56e9 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/server/lib/audit/page-analyzer.test.ts:282`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-9eb425e04f83 — medium — false_positive

Reviewed unsafe-dynamic-method audit match.

Location: `src/server/lib/audit/url-policy.test.ts:62`. Agent: B. Confidence: high.

Identifiers: CWE-94: Improper Control of Generation of Code ('Code Injection').

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-5f0582d087ab — medium — false_positive

Reviewed detect-redos audit match.

Location: `src/server/mcp/tools/dataforseo-research-tools.ts:144`. Agent: B. Confidence: high.

Identifiers: CWE-1333: Inefficient Regular Expression Complexity.

Evidence: Hostname expression has disjoint literal-dot separators and a 253/255-character bound before matching; the audit rule does not model this constraint.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-2ca8b5e4b6b0 — medium — false_positive

Reviewed detect-redos audit match.

Location: `src/shared/crawler-access.ts:60`. Agent: B. Confidence: high.

Identifiers: CWE-1333: Inefficient Regular Expression Complexity.

Evidence: The hostname expression separates repeated labels with literal dots outside the label character class; it has no overlapping nested repetition. Alchemy input is also operator configuration.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-8eef99cda710 — medium — false_positive

Reviewed hardcoded-hmac-key audit match.

Location: `src/shared/gdpr-erasure.test.ts:10`. Agent: B. Confidence: high.

Identifiers: CWE-798: Use of Hard-coded Credentials.

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-c0c0e4e9d231 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `src/shared/report-sandbox.ts:93`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Interpolated PRINT_SCRIPT is a static developer-authored script. Report content remains constrained by the separate report sandbox CSP and iframe policy.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-ac894e018248 — medium — false_positive

Reviewed html-in-template-string audit match.

Location: `web/scripts/generate-sitemap.js:148`. Agent: B. Confidence: high.

Identifiers: CWE-116: Improper Encoding or Escaping of Output.

Evidence: Build-time sitemap uses operator SITE_URL and repository-authored route/content metadata. No request or remotely submitted content reaches this XML template.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-c1759d5517a5 — medium — false_positive

Reviewed react-dangerouslysetinnerhtml audit match.

Location: `web/src/components/library-page.tsx:79`. Agent: B. Confidence: high.

Identifiers: CWE-79: Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting').

Evidence: Breadcrumb JSON-LD inputs are repository-authored MDX library metadata, not user/remote content. No attacker-controlled route parameter is inserted into this script.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-4675042a6d12 — medium — false_positive

Reviewed detect-redos audit match.

Location: `web/src/lib/free-tools/server.ts:38`. Agent: B. Confidence: high.

Identifiers: CWE-1333: Inefficient Regular Expression Complexity.

Evidence: Hostname expression has disjoint literal-dot separators and a 253/255-character bound before matching; the audit rule does not model this constraint.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-60e3aa8dc8b7 — medium — false_positive

Reviewed js/stack-trace-exposure audit match.

Location: `.agents/skills/evaluate-skill/scripts/run.mjs:235`. Agent: B. Confidence: high.

Identifiers: CWE-209, CWE-497.

Evidence: Local evaluation gateway listens only on127.0.0.1 and returns String(error), not an error stack. It is an operator-invoked development harness, not a deployed API endpoint; keep it loopback-only.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-6a5a7d2cf469 — medium — false_positive

Reviewed js/file-access-to-http audit match.

Location: `scripts/migrate-d1-to-postgres.ts:122`. Agent: B. Confidence: high.

Identifiers: CWE-200.

Evidence: Operator-run migration intentionally reads the non-secret D1 database ID from wrangler.jsonc and inserts it into the fixed api.cloudflare.com query endpoint. It does not send arbitrary files to an attacker-selected host.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-cb9fa3a4f430 — medium — false_positive

Reviewed js/http-to-file-access audit match.

Location: `.agents/skills/evaluate-skill/scripts/run.mjs:217`. Agent: B. Confidence: high.

Identifiers: CWE-912, CWE-434.

Evidence: Intentional evaluation report capture after the allowed-tool and assigned-project checks. Output path is constructed from operator-selected output directory and sanitized per-run name, never from an HTTP filename/path.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-f952da48a319 — medium — false_positive

Reviewed js/http-to-file-access audit match.

Location: `.agents/skills/evaluate-skill/scripts/run.mjs:227`. Agent: B. Confidence: high.

Identifiers: CWE-912, CWE-434.

Evidence: Intentional evaluation report capture after the allowed-tool and assigned-project checks. Output path is constructed from operator-selected output directory and sanitized per-run name, never from an HTTP filename/path.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-002 — medium — fixed

User-authored split-test and release-gate expressions ran on the native backtracking regular-expression engine.

Location: `src/server/features/split-tests/splitTestBaseline.ts; src/server/features/split-tests/splitTestHistory.ts; src/server/features/seo-checks/seoRules.ts`. Agent: B. Confidence: high.

Identifiers: CWE-1333, CWE-400.

Evidence: Official Semgrep detect-non-literal-regexp identified native dynamic matching. A safe isolated Node subprocess testing ^/(a+)+$ against a 34-character path exceeded 2 seconds and was terminated. Input validation previously checked syntax only.

Impact: An authorized project operator or repository change could exhaust the CPU budget for a backtest or release check. Length-limiting the pattern alone did not prevent exponential matching.

Remediation: Use RE2JS matching and validate the RE2 feature set at configuration boundaries. Existing patterns using lookaround/backreferences require replacement; stored gate configuration now fails explicitly instead of silently dropping ignores.

Verification: ["2026-10-25: 1000-character adversarial input completes through public weigh entry point; unsupported backreference syntax is rejected by gate and split-test schemas.", "2026-10-25: DB-backed planCheck regression rejects unsupported stored gate config; saved split-test failures use actionable INVALID_PATH_PATTERN client copy.", "2026-10-25: focused regression suite 105/105 passed across 22 files. Original native-regex findings in remediated paths absent from final Semgrep rescan.", "Compatibility: RE2 matching preserves ordinary path search/anchors but intentionally rejects unsupported constructs. Recreate saved split tests with supported patterns; update relay-gate.json before retrying queued runs."]

### DEP-03da3a63cf76 — medium — fixed

launch-editor: escapeCmdArgs() omits % escaping on Windows

Location: `./pnpm-lock.yaml, web/pnpm-lock.yaml, tests/badseo/pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-112943, CWE-78, GHSA-698v-4r3x-3vcv.

Evidence: ['Lockfile resolves vite@7.3.6; advisory affected range: >=7.0.0 <=7.3.6.', '.>vite']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 7.3.7 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-0687e1f9b01f — medium — fixed

Vitest: Windows backslash traversal bypasses the @vitest/mocker redirect allowlist fix

Location: `./pnpm-lock.yaml, web/pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-112950, CWE-22, GHSA-xp26-3454-mjgp.

Evidence: ['Lockfile resolves @vitest/mocker@4.1.11; advisory affected range: >=4.1.11 <4.1.12.', '.>vitest>@vitest/mocker']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 4.1.12 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-2d924b2c6a43 — medium — fixed

smol-toml: Quadratic-time parse() from parseKey rescanning to end of document on each key line

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CWE-407, GHSA-r4xh-jqrq-34v2.

Evidence: ['Lockfile resolves smol-toml@1.8.0; advisory affected range: <=1.8.0.', '.>knip>smol-toml']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 1.9.0 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-3afb560256b0 — medium — fixed

launch-editor: Editor CLI flag misinterpretation causing arbitrary command execution for some editors

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-112944, CWE-88, GHSA-r825-w8mm-5pxw.

Evidence: ['Lockfile resolves launch-editor@2.14.1; advisory affected range: <=2.14.1.', '.>@tanstack/devtools-vite>launch-editor']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 2.14.2 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-4318dbb6fe7c — medium — fixed

Vitest: Code injection via unauthenticated manual mock registration

Location: `./pnpm-lock.yaml, web/pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-112949, CWE-116, CWE-306, CWE-94, GHSA-qxg6-89mg-rqv8.

Evidence: ['Lockfile resolves @vitest/mocker@4.1.11; advisory affected range: >=2.1.0-beta.7 <4.1.12.', '.>vitest>@vitest/mocker']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 4.1.12 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-49d523bf23d8 — medium — unverified

ip-address: ip-address: Denial of Service via excessive percent characters in IPv6 address input

Location: `image:Node.js`. Agent: D. Confidence: high.

Identifiers: CVE-2026-111997, CWE-1333, GHSA-rxp7-6hxx-x8q5.

Evidence: Scanner matched ip-address@10.7.2 against its vulnerability database.

Impact: The affected package is bundled inside the global npm CLI. It is not the application lockfile copy, and application HTTP reachability is unverified.

Remediation: Request patched bundled dependencies from npm, or maintain and test a focused vendor patch. npm12.2.1 official tarball was also inspected and still bundles ip-address10.7.2 and undici6.29.0, so another major bump does not resolve these detections.

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md.", "Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "Official npm12.2.1 registry tarball package.json versions independently inspected; same vulnerable bundled versions remain."]

### DEP-68cd6e2670db — medium — fixed

Vite: Files outside `server.fs.allow` could be served when project paths match system paths on non-Windows machine

Location: `./pnpm-lock.yaml, web/pnpm-lock.yaml, tests/badseo/pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-112946, CWE-22, CWE-284, GHSA-rq7h-c2jc-7f22.

Evidence: ['Lockfile resolves vite@7.3.6; advisory affected range: >=7.0.0 <=7.3.6.', '.>vite']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 7.3.7 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-6b4688b24a35 — medium — fixed

fast-uri vulnerable to host confusion via unchecked WHATWG host canonicalization

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-110180, CWE-20, CWE-436, GHSA-wjr9-j795-jxcr.

Evidence: ['Lockfile resolves fast-uri@3.1.8; advisory affected range: >=3.1.3 <3.1.9.', '.>shadcn>@dotenvx/dotenvx>conf>ajv>fast-uri']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 3.1.9 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-7094e88694e8 — medium — fixed

MCP TypeScript SDK: Server bearer authentication accepted tokens issued for another service

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-111771, CWE-863, GHSA-rvq5-wwqv-78pq.

Evidence: ['Lockfile resolves @modelcontextprotocol/server@2.0.0; advisory affected range: >=2.0.0 <2.3.0.', '.>@modelcontextprotocol/server']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 2.3.0 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-73d6ad9a34a4 — medium — fixed

MCP TypeScript SDK: Server bearer authentication accepted tokens issued for another service

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-111771, CWE-863, GHSA-rvq5-wwqv-78pq.

Evidence: ['Lockfile resolves @modelcontextprotocol/sdk@1.30.0; advisory affected range: >=1.6.0 <1.32.0.', '.>shadcn>@modelcontextprotocol/sdk', '.>@modelcontextprotocol/sdk']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 1.32.0 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-7c980ca3d4e1 — medium — fixed

undici vulnerable to Subresource Integrity bypass via non-lowercase algorithm tokens

Location: `./pnpm-lock.yaml, web/pnpm-lock.yaml, tests/badseo/pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-109841, CWE-178, GHSA-f72v-6w45-q472.

Evidence: ['Lockfile resolves undici@7.29.1; advisory affected range: >=7.15.0 <7.30.1.', '.>@cloudflare/vite-plugin>miniflare>undici']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 7.30.1 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-837b8aaa65f7 — medium — fixed

fast-uri vulnerable to URI scheme spoofing via percent-encoded scheme decoding

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-110306, CWE-172, CWE-180, GHSA-w74x-v6f9-j3xg.

Evidence: ['Lockfile resolves fast-uri@3.1.8; advisory affected range: >=3.0.0 <3.1.9.', '.>shadcn>@dotenvx/dotenvx>conf>ajv>fast-uri']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 3.1.9 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-98b5576d00be — medium — fixed

Hono: `serveStatic` decodes the request path a second time, leading to bypass of middleware on static paths

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-111757, CWE-174, GHSA-5r4p-p66f-jhc7.

Evidence: ['Lockfile resolves hono@4.13.7; advisory affected range: >=4.12.4 <4.13.11.', '.>shadcn>@modelcontextprotocol/sdk>hono']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 4.13.11 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-cda9cf9561d4 — medium — fixed

undici vulnerable to Denial of Service via unbounded memory in the EventSource parser

Location: `./pnpm-lock.yaml, web/pnpm-lock.yaml, tests/badseo/pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-109924, CWE-770, GHSA-4qv8-2p9j-2685.

Evidence: ['Lockfile resolves undici@7.29.1; advisory affected range: >=7.0.0 <7.30.1.', '.>@cloudflare/vite-plugin>miniflare>undici']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 7.30.1 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-d26debb86eca — medium — fixed

MCP TypeScript client SDK: HTTP client transports and OAuth requests followed cross-origin redirects and re-sent custom headers and request bodies

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-111769, CWE-200, GHSA-6prh-2h8m-c8cw.

Evidence: ['Lockfile resolves @modelcontextprotocol/client@2.0.0; advisory affected range: >=2.0.0 <2.3.0.', '.>@modelcontextprotocol/client']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 2.3.0 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-e4d83f2646e8 — medium — fixed

launch-editor: Editor CLI flag misinterpretation causing arbitrary command execution for some editors

Location: `./pnpm-lock.yaml, web/pnpm-lock.yaml, tests/badseo/pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-112944, CWE-88, GHSA-r825-w8mm-5pxw.

Evidence: ['Lockfile resolves vite@7.3.6; advisory affected range: >=7.0.0 <=7.3.6.', '.>vite']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 7.3.7 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-ed55f882d450 — medium — fixed

ws: Uninitialized memory disclosure

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-45736, CWE-908, GHSA-58qx-3vcg-4xpx.

Evidence: ['Lockfile resolves ws@8.17.1; advisory affected range: >=8.0.0 <8.20.1.', '.>@trigger.dev/sdk>@trigger.dev/core>socket.io-client>engine.io-client>ws']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 8.20.1 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-f29b635f327e — medium — fixed

launch-editor: escapeCmdArgs() omits % escaping on Windows

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-112943, CWE-78, GHSA-698v-4r3x-3vcv.

Evidence: ['Lockfile resolves launch-editor@2.14.1; advisory affected range: <=2.14.1.', '.>@tanstack/devtools-vite>launch-editor']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 2.14.2 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-fc348f10e768 — medium — fixed

MCP TypeScript client SDK: HTTP client transports and OAuth requests followed cross-origin redirects and re-sent custom headers and request bodies

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-111769, CWE-200, GHSA-6prh-2h8m-c8cw.

Evidence: ['Lockfile resolves @modelcontextprotocol/sdk@1.30.0; advisory affected range: <1.32.0.', '.>shadcn>@modelcontextprotocol/sdk', '.>@modelcontextprotocol/sdk']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 1.32.0 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### INFRA-ROOT-USER — medium — confirmed

Image user should not be 'root'

Location: `deploy/docker/Dockerfile`. Agent: D. Confidence: high.

Identifiers: CWE-250.

Evidence: Dockerfile has no USER instruction; node:22 defaults to UID 0.

Impact: A compromised application process has root privileges inside its container; this is not evidence of a remote-code-execution defect.

Remediation: Migrate existing root-owned /app/.wrangler volumes and writable build/cache paths before adopting USER node; validate upgrade and restart behavior.

Verification: ["Trivy DS-0002 original severity HIGH; adjusted to medium for conditional privilege-amplification impact.", "Checkov CKV_DOCKER_3 independently confirms the default root user."]

### INFRA-B7323E36606F — medium — unverified

util-linux: util-linux: heap use-after-free in libblkid nested partition probing

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-13595, CWE-416.

Evidence: Scanner matched bsdutils@1:2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-9DCB5C88F005 — medium — unverified

util-linux: TOCTOU in the mount program when setting up loop devices

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-27456, CWE-59, CWE-269, CWE-367.

Evidence: Scanner matched bsdutils@1:2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-B4A3E813A817 — medium — unverified

util-linux: util-linux: Access control bypass due to improper hostname canonicalization

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-3184, CWE-289.

Evidence: Scanner matched bsdutils@1:2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-DF54FBBDE31A — medium — unverified

gcc-toolset-15-gcc: gcc: gcc-toolset-16: gcc: Denial of Service via use-after-free in binary heap erase_if

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-102010, CWE-825.

Evidence: Scanner matched gcc-12-base@12.2.0-14+deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-CF2FEF382198 — medium — unverified

gcc: libstdc++ integer overflow in `new` operator

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-95619, CWE-190.

Evidence: Scanner matched gcc-12-base@12.2.0-14+deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-3E2E799D3C26 — medium — unverified

gnupg: verification DoS due to a malicious subkey in the keyring

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-30258, CWE-754.

Evidence: Scanner matched gpgv@2.2.40-1.1+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-B1C864BED885 — medium — unverified

gnupg: GnuPG: Signature bypass via form feed character in signed messages

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-68972, CWE-347.

Evidence: Scanner matched gpgv@2.2.40-1.1+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-CAC4E93A4FF7 — medium — unverified

gzip: gzip: Arbitrary file overwrite via insecure temporary file handling in gzexe utility

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-41991, CWE-377.

Evidence: Scanner matched gzip@1.12-1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-F2EFC1F74D12 — medium — unverified

acl: TOCTOU Symlink Traversal via getfacl/setfacl

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-54370, CWE-367.

Evidence: Scanner matched libacl1@2.3.1-3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-8E3D72E69A3C — medium — unverified

attr: attr: Symlink Traversal Privilege Escalation via getfattr and setfattr

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-54371, CWE-59.

Evidence: Scanner matched libattr1@1:2.5.1-4 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-B56E53CD71DC — medium — unverified

util-linux: util-linux: heap use-after-free in libblkid nested partition probing

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-13595, CWE-416.

Evidence: Scanner matched libblkid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-F6956C0E36FF — medium — unverified

util-linux: TOCTOU in the mount program when setting up loop devices

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-27456, CWE-59, CWE-269, CWE-367.

Evidence: Scanner matched libblkid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-9DD2CEB65C99 — medium — unverified

util-linux: util-linux: Access control bypass due to improper hostname canonicalization

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-3184, CWE-289.

Evidence: Scanner matched libblkid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-62EC63B1D829 — medium — unverified

bzip2: bzip2: Denial of Service in bzip2recover via a specially crafted file

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-42250, CWE-787.

Evidence: Scanner matched libbz2-1.0@1.0.8-5+b1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-48659CD6F3E9 — medium — unverified

glibc: glibc: Heap buffer overflow via attacker-controlled fopen mode string

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-18374, CWE-787.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-8C0ABCCFDAAF — medium — unverified

glibc: Buffer Overflow in strfmon right-justification padding

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-19499, CWE-122.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-0B4ADDFD136F — medium — unverified

glibc: Fix out-of-bounds array write in tdelete

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-19542, CWE-121.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-8A025CEACD62 — medium — unverified

glibc: glibc: Out-of-bounds write via TSIG record processing

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-5435, CWE-787.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-93B1BD82A8DE — medium — unverified

glibc: glibc: Heap Buffer Overflow in `scanf` with `%mc` format specifier and large width

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-5450, CWE-122, CWE-787.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-C066D4DAC2D5 — medium — unverified

glibc: glibc: Information disclosure or denial of service via ungetwc function with specific wide character encodings

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-5928, CWE-127.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-7BC8F0EF74D9 — medium — unverified

glibc: glibc: Application crash or uninitialized memory read via crafted DNS response

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-6238, CWE-126.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-AED41B4C995F — medium — unverified

glibc: glibc: Process abort due to invalid memory in wordexp

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-6368, CWE-908.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-ABBC2BE4C651 — medium — unverified

glibc: Glibc: Denial of Service via stack exhaustion during tilde expansion

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-6791, CWE-121.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-4756DCE47B62 — medium — unverified

glibc: Non-progress DoS in SHIFT_JISX0213 -&gt

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-77117, CWE-835.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-F5AC17E3C601 — medium — unverified

glibc: Non-progress DoS in EUC_JISX0213 -> UCS-4 conversion state

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-80489, CWE-835.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-AD70B2A1A473 — medium — unverified

glibc: glibc DNS stub resolver: Denial of Service via long search domain in configuration

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-8674, CWE-617.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-BD3082E9188F — medium — unverified

glibc: glibc: Privilege escalation and arbitrary code execution via TOCTOU race condition in dynamic loader

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-86805, CWE-367.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-6ECFF4863ECD — medium — unverified

glibc: nscd stack overflow leads to degraded DNS resolution

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-89092, CWE-789.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-472018E1D032 — medium — unverified

glibc: glibc: Local attacker can cause denial of service and information disclosure via stack-based buffer overflow.

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-95818, CWE-121.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-16E7E93A3E85 — medium — unverified

glibc: glibc: Heap buffer overflow via attacker-controlled fopen mode string

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-18374, CWE-787.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-3C7EBCC07E16 — medium — unverified

glibc: Buffer Overflow in strfmon right-justification padding

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-19499, CWE-122.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-89E0A42CC60D — medium — unverified

glibc: Fix out-of-bounds array write in tdelete

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-19542, CWE-121.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-B084C632A4AC — medium — unverified

glibc: glibc: Out-of-bounds write via TSIG record processing

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-5435, CWE-787.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-A63A2471249B — medium — unverified

glibc: glibc: Heap Buffer Overflow in `scanf` with `%mc` format specifier and large width

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-5450, CWE-122, CWE-787.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-E741322A697C — medium — unverified

glibc: glibc: Information disclosure or denial of service via ungetwc function with specific wide character encodings

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-5928, CWE-127.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-42BE87EAA83A — medium — unverified

glibc: glibc: Application crash or uninitialized memory read via crafted DNS response

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-6238, CWE-126.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-C7A317C4E618 — medium — unverified

glibc: glibc: Process abort due to invalid memory in wordexp

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-6368, CWE-908.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-4157FFF064BD — medium — unverified

glibc: Glibc: Denial of Service via stack exhaustion during tilde expansion

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-6791, CWE-121.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-D47477B5006C — medium — unverified

glibc: Non-progress DoS in SHIFT_JISX0213 -&gt

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-77117, CWE-835.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-1800C18DD3D2 — medium — unverified

glibc: Non-progress DoS in EUC_JISX0213 -> UCS-4 conversion state

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-80489, CWE-835.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-6544537BAA27 — medium — unverified

glibc: glibc DNS stub resolver: Denial of Service via long search domain in configuration

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-8674, CWE-617.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-D24D629CBB58 — medium — unverified

glibc: glibc: Privilege escalation and arbitrary code execution via TOCTOU race condition in dynamic loader

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-86805, CWE-367.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-73D952C25E60 — medium — unverified

glibc: nscd stack overflow leads to degraded DNS resolution

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-89092, CWE-789.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-D7136FB229DA — medium — unverified

glibc: glibc: Local attacker can cause denial of service and information disclosure via stack-based buffer overflow.

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-95818, CWE-121.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-A75CD4B5D1E1 — medium — unverified

gcc-toolset-15-gcc: gcc: gcc-toolset-16: gcc: Denial of Service via use-after-free in binary heap erase_if

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-102010, CWE-825.

Evidence: Scanner matched libgcc-s1@12.2.0-14+deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-8492C8A75300 — medium — unverified

gcc: libstdc++ integer overflow in `new` operator

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-95619, CWE-190.

Evidence: Scanner matched libgcc-s1@12.2.0-14+deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-CDB2662B0EE8 — medium — unverified

util-linux: util-linux: heap use-after-free in libblkid nested partition probing

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-13595, CWE-416.

Evidence: Scanner matched libmount1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-4FED1BBA7656 — medium — unverified

util-linux: TOCTOU in the mount program when setting up loop devices

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-27456, CWE-59, CWE-269, CWE-367.

Evidence: Scanner matched libmount1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-A758BCB6EBF0 — medium — unverified

util-linux: util-linux: Access control bypass due to improper hostname canonicalization

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-3184, CWE-289.

Evidence: Scanner matched libmount1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-479C86776C90 — medium — unverified

p11-kit: Stack exhaustion via unbounded recursion in RPC attribute parsing

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-13757, CWE-674.

Evidence: Scanner matched libp11-kit0@0.24.1-2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-88D50530602E — medium — unverified

p11-kit: Integer overflow in RPC attribute-array length calculation can under-allocate nested attribute storage on 32 bit systems

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-18938, CWE-122.

Evidence: Scanner matched libp11-kit0@0.24.1-2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-7F9AF0DB2B78 — medium — unverified

pam: libpam: Libpam vulnerable to read hashed password

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2024-10041, CWE-922.

Evidence: Scanner matched libpam-modules@1.5.2-6+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-A8434918E079 — medium — unverified

linux-pam: Plaintext password recovery via timing discrepancy in pam_userdb module

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-54411, CWE-208.

Evidence: Scanner matched libpam-modules@1.5.2-6+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-5D07360C037B — medium — unverified

pam: libpam: Libpam vulnerable to read hashed password

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2024-10041, CWE-922.

Evidence: Scanner matched libpam-modules-bin@1.5.2-6+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-A14D1BCEA92F — medium — unverified

linux-pam: Plaintext password recovery via timing discrepancy in pam_userdb module

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-54411, CWE-208.

Evidence: Scanner matched libpam-modules-bin@1.5.2-6+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-8A66510BEEC3 — medium — unverified

pam: libpam: Libpam vulnerable to read hashed password

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2024-10041, CWE-922.

Evidence: Scanner matched libpam-runtime@1.5.2-6+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-06D62F6603E0 — medium — unverified

linux-pam: Plaintext password recovery via timing discrepancy in pam_userdb module

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-54411, CWE-208.

Evidence: Scanner matched libpam-runtime@1.5.2-6+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-4C662D21C4D7 — medium — unverified

pam: libpam: Libpam vulnerable to read hashed password

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2024-10041, CWE-922.

Evidence: Scanner matched libpam0g@1.5.2-6+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-62183504A08B — medium — unverified

linux-pam: Plaintext password recovery via timing discrepancy in pam_userdb module

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-54411, CWE-208.

Evidence: Scanner matched libpam0g@1.5.2-6+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-38994065BEFD — medium — unverified

util-linux: util-linux: heap use-after-free in libblkid nested partition probing

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-13595, CWE-416.

Evidence: Scanner matched libsmartcols1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-9C4DB007F1D0 — medium — unverified

util-linux: TOCTOU in the mount program when setting up loop devices

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-27456, CWE-59, CWE-269, CWE-367.

Evidence: Scanner matched libsmartcols1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-18E90F228797 — medium — unverified

util-linux: util-linux: Access control bypass due to improper hostname canonicalization

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-3184, CWE-289.

Evidence: Scanner matched libsmartcols1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-17B283F96BCB — medium — unverified

openssl: OpenSSL: Private key recovery via timing side-channel in generic elliptic curve operations

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-54872, CWE-208.

Evidence: Scanner matched libssl3@3.0.22-1~deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-E2907649B617 — medium — unverified

openssl: openssl: Denial of Service via crafted CMP certificate revocation response

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-75805, CWE-476.

Evidence: Scanner matched libssl3@3.0.22-1~deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-9A84341A3592 — medium — unverified

openssl: OpenSSL: Denial of Service via undersized DTLS record

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-75806, CWE-1284.

Evidence: Scanner matched libssl3@3.0.22-1~deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-1394AE066E3C — medium — unverified

openssl: OpenSSL: Private key recovery via SM2 timing side-channel

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-77696, CWE-208.

Evidence: Scanner matched libssl3@3.0.22-1~deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-9597837F4718 — medium — unverified

gcc-toolset-15-gcc: gcc: gcc-toolset-16: gcc: Denial of Service via use-after-free in binary heap erase_if

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-102010, CWE-825.

Evidence: Scanner matched libstdc++6@12.2.0-14+deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-ECE32C1C213E — medium — unverified

gcc: libstdc++ integer overflow in `new` operator

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-95619, CWE-190.

Evidence: Scanner matched libstdc++6@12.2.0-14+deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-19BB65150C7E — medium — unverified

systemd: systemd-oomd: Unprivileged users can terminate arbitrary processes via IPC API

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-15059, CWE-22, CWE-59.

Evidence: Scanner matched libsystemd0@252.39-1~deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-7C473393D194 — medium — unverified

ncurses: segmentation fault via _nc_wrap_entry()

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2023-50495.

Evidence: Scanner matched libtinfo6@6.4-4 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-306A96390602 — medium — unverified

systemd: systemd-oomd: Unprivileged users can terminate arbitrary processes via IPC API

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-15059, CWE-22, CWE-59.

Evidence: Scanner matched libudev1@252.39-1~deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-75DD644B03D9 — medium — unverified

util-linux: util-linux: heap use-after-free in libblkid nested partition probing

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-13595, CWE-416.

Evidence: Scanner matched libuuid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-2624FAD8A89D — medium — unverified

util-linux: TOCTOU in the mount program when setting up loop devices

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-27456, CWE-59, CWE-269, CWE-367.

Evidence: Scanner matched libuuid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-8B9301F37E1B — medium — unverified

util-linux: util-linux: Access control bypass due to improper hostname canonicalization

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-3184, CWE-289.

Evidence: Scanner matched libuuid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-C3856DB511B6 — medium — unverified

util-linux: util-linux: heap use-after-free in libblkid nested partition probing

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-13595, CWE-416.

Evidence: Scanner matched mount@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-E43CD9B63668 — medium — unverified

util-linux: TOCTOU in the mount program when setting up loop devices

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-27456, CWE-59, CWE-269, CWE-367.

Evidence: Scanner matched mount@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-E55CF13BBC25 — medium — unverified

util-linux: util-linux: Access control bypass due to improper hostname canonicalization

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-3184, CWE-289.

Evidence: Scanner matched mount@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-27984D0DDD71 — medium — unverified

ncurses: segmentation fault via _nc_wrap_entry()

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2023-50495.

Evidence: Scanner matched ncurses-base@6.4-4 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-A8448745ED00 — medium — unverified

ncurses: segmentation fault via _nc_wrap_entry()

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2023-50495.

Evidence: Scanner matched ncurses-bin@6.4-4 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-E9198859135E — medium — unverified

openssl: OpenSSL: Private key recovery via timing side-channel in generic elliptic curve operations

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-54872, CWE-208.

Evidence: Scanner matched openssl@3.0.22-1~deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-35EAAC027F65 — medium — unverified

openssl: openssl: Denial of Service via crafted CMP certificate revocation response

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-75805, CWE-476.

Evidence: Scanner matched openssl@3.0.22-1~deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-D0B7D991DDC8 — medium — unverified

openssl: OpenSSL: Denial of Service via undersized DTLS record

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-75806, CWE-1284.

Evidence: Scanner matched openssl@3.0.22-1~deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-C3778525FE50 — medium — unverified

openssl: OpenSSL: Private key recovery via SM2 timing side-channel

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-77696, CWE-208.

Evidence: Scanner matched openssl@3.0.22-1~deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-57C89CE698E7 — medium — unverified

perl: Perl: Arbitrary code execution via out-of-bounds memory access in regular expression engine.

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-15534, CWE-125, CWE-190, CWE-787.

Evidence: Scanner matched perl-base@5.36.0-7+deb12u4 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-298E8FC15432 — medium — unverified

tar: tar: TOCTOU in incremental dumpdir 'X' rename handling allows restore path escape

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-18477, CWE-367.

Evidence: Scanner matched tar@1.34+dfsg-1.2+deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-AE10669279CE — medium — unverified

tar: tar: --one-top-level hardlink targets not confined to top-level directory enabling arbitrary file overwrite

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-18508, CWE-59.

Evidence: Scanner matched tar@1.34+dfsg-1.2+deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-0F8569243F51 — medium — unverified

tar: tar: Hidden file injection via crafted archives

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-5704, CWE-434.

Evidence: Scanner matched tar@1.34+dfsg-1.2+deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-2AE784B604A7 — medium — unverified

util-linux: util-linux: heap use-after-free in libblkid nested partition probing

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-13595, CWE-416.

Evidence: Scanner matched util-linux@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-25CB331D052F — medium — unverified

util-linux: TOCTOU in the mount program when setting up loop devices

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-27456, CWE-59, CWE-269, CWE-367.

Evidence: Scanner matched util-linux@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-DD3A3157566A — medium — unverified

util-linux: util-linux: Access control bypass due to improper hostname canonicalization

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-3184, CWE-289.

Evidence: Scanner matched util-linux@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-3DDC66BAB959 — medium — unverified

util-linux: util-linux: heap use-after-free in libblkid nested partition probing

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-13595, CWE-416.

Evidence: Scanner matched util-linux-extra@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-76F0B5D10105 — medium — unverified

util-linux: TOCTOU in the mount program when setting up loop devices

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-27456, CWE-59, CWE-269, CWE-367.

Evidence: Scanner matched util-linux-extra@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-DAE7680A2DFE — medium — unverified

util-linux: util-linux: Access control bypass due to improper hostname canonicalization

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-3184, CWE-289.

Evidence: Scanner matched util-linux-extra@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-292CB309B714 — medium — unverified

zlib: zlib: Denial of Service via infinite loop in CRC32 combine functions

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-27171, CWE-1284.

Evidence: Scanner matched zlib1g@1:1.2.13.dfsg-1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-A34B896FF1F1 — medium — unverified

zlib versions 1.3.1.2 through 1.3.2 contain a heap buffer overflow vul ...

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-85091, CWE-787.

Evidence: Scanner matched zlib1g@1:1.2.13.dfsg-1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-1CC2639AFFA7 — medium — unverified

undici: undici: Denial of Service via memory exhaustion in EventSource client

Location: `image:Node.js`. Agent: D. Confidence: high.

Identifiers: CVE-2026-109924, CWE-770.

Evidence: Scanner matched undici@6.29.0 against its vulnerability database.

Impact: The affected package is bundled inside the global npm CLI. It is not the application lockfile copy, and application HTTP reachability is unverified.

Remediation: Request patched bundled dependencies from npm, or maintain and test a focused vendor patch. npm12.2.1 official tarball was also inspected and still bundles ip-address10.7.2 and undici6.29.0, so another major bump does not resolve these detections.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "Official npm12.2.1 registry tarball package.json versions independently inspected; same vulnerable bundled versions remain."]

### INFRA-9255F50BB747 — medium — unverified

net/url: Insufficient validation of bracketed IPv6 hostnames in net/url

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2025-47912.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-EB9AAA10FFAD — medium — unverified

golang: archive/tar: Unbounded allocation when parsing GNU sparse map

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2025-58183.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-6CD263F2C66A — medium — unverified

encoding/asn1: Parsing DER payload can cause memory exhaustion in encoding/asn1

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2025-58185, CWE-770.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-6B87B8F78D21 — medium — unverified

crypto/x509: Quadratic complexity when checking name constraints in crypto/x509

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2025-58187, CWE-407.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-39DB998906F5 — medium — unverified

crypto/x509: golang: Panic when validating certificates with DSA public keys in crypto/x509

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2025-58188, CWE-295.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-5D29731E223F — medium — unverified

crypto/tls: go crypto/tls ALPN negotiation error contains attacker controlled information

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2025-58189, CWE-532.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-B617707FD7D6 — medium — unverified

encoding/pem: Quadratic complexity when parsing some invalid inputs in encoding/pem

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2025-61723, CWE-770.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-30BDC6B66885 — medium — unverified

net/textproto: Excessive CPU consumption in Reader.ReadResponse in net/textproto

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2025-61724, CWE-770.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-8DCC69613BF6 — medium — unverified

net/mail: Excessive CPU consumption in ParseAddress in net/mail

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2025-61725.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-EC7E22BE586B — medium — unverified

golang: crypto/x509: excluded subdomain constraint does not restrict wildcard SANs

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2025-61727, CWE-295.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-10CFF233C7B7 — medium — unverified

golang: archive/zip: Excessive CPU consumption when building archive index in archive/zip

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2025-61728, CWE-770.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-57ED3E681181 — medium — unverified

crypto/tls: Handshake messages may be processed at the incorrect encryption level in crypto/tls

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2025-61730.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-461818B1ABFC — medium — unverified

html/template: URLs in meta content attribute actions are not escaped in html/template

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-27142, CWE-79.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-B7714AEBDD6F — medium — unverified

golang: internal/syscall/unix: Root.Chmod can follow symlinks out of the root

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-32282, CWE-59.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-A38D57AA09CC — medium — unverified

archive/tar: golang: Go's archive/tar package: Denial of Service via maliciously-crafted archive

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-32288, CWE-770.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-8D0BD2A5D446 — medium — unverified

html/template: golang: html/template: Cross-Site Scripting (XSS) via improper context and brace depth tracking in JS template literals

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-32289, CWE-79.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-8A7D9CC05461 — medium — unverified

html/template: golang: Go html/template: Cross-Site Scripting via improper URL escaping in meta tag content

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-39823, CWE-79.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-7CFF5A4A1AB6 — medium — unverified

net/http/httputil: golang: net/http/httputil: ReverseProxy forwards hidden query parameters, potentially bypassing security controls

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-39825.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-20CA3A76D215 — medium — unverified

html/template: golang: html/template: Cross-site scripting due to incorrect script tag escaping

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-39826, CWE-116.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-06D51E74AC2C — medium — unverified

crypto/tls: golang: Go crypto/tls: Information disclosure in Encrypted Client Hello

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-42505, CWE-201.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-AF5EF85DAEAE — medium — unverified

net/textproto: golang: Golang net/textproto: Misleading error messages via input injection

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-42507.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-9DB070C52A55 — medium — unverified

net/http: golang: golang: Cross-user response poisoning via desynchronized HTTP CONNECT connections

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56866, CWE-444.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-06D6D10832A1 — medium — unverified

net/http: golang.org/x/net/http2: golang: net/http: Denial of Service via HTTP/2 trailer header memory exhaustion

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78659, CWE-405.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-E63BB7602228 — medium — unverified

net/http: golang: golang.org/x/net/http2: net/http: HTTP response smuggling via malformed HTTP/2 framing headers

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78660, CWE-444.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-CA7A2632C3E8 — medium — unverified

net/http: net/http/internal/http2: golang: golang.org/x/net/http2: golang: flow control limit bypass via double refund in HTTP/2 server

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78663, CWE-675.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-14313A25C9AC — medium — unverified

net/http: golang: net/http: HTTP request smuggling via improper handling of HTTP/1 CONNECT responses

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-94439, CWE-444.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-F5C164F8DE54 — medium — unverified

net/textproto: mime/multipart: golang: golang: Denial of Service via memory limit bypass in multipart form parsing

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-94440, CWE-770.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-0415061BC662 — medium — unverified

html/template: golang: golang: cross-site scripting via consecutive expressions in JavaScript template literals

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-94448, CWE-79.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-C3929EE3FDFE — medium — unverified

html/template: golang: html/template: Cross-site scripting via improper escaping of yield keyword

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-97030, CWE-79.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-C5F11AF03C9A — medium — unverified

net/http: net/http/internal/http2: golang: golang.org/x/net/http2: net/http: Denial of Service via concurrent HPACK encoder modification

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-97032, CWE-362.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-EC65611304E9 — medium — unverified

html/template: URLs in meta content attribute actions are not escaped in html/template

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-27142, CWE-79.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-CEF828765476 — medium — unverified

golang: internal/syscall/unix: Root.Chmod can follow symlinks out of the root

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-32282, CWE-59.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-B3324748A303 — medium — unverified

archive/tar: golang: Go's archive/tar package: Denial of Service via maliciously-crafted archive

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-32288, CWE-770.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-6EAFE07069AF — medium — unverified

html/template: golang: html/template: Cross-Site Scripting (XSS) via improper context and brace depth tracking in JS template literals

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-32289, CWE-79.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-E934E62F8135 — medium — unverified

html/template: golang: Go html/template: Cross-Site Scripting via improper URL escaping in meta tag content

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-39823, CWE-79.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-DD507B53531F — medium — unverified

net/http/httputil: golang: net/http/httputil: ReverseProxy forwards hidden query parameters, potentially bypassing security controls

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-39825.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-F9D8B1E8A55B — medium — unverified

html/template: golang: html/template: Cross-site scripting due to incorrect script tag escaping

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-39826, CWE-116.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-0D1D9E77C2F6 — medium — unverified

crypto/tls: golang: Go crypto/tls: Information disclosure in Encrypted Client Hello

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-42505, CWE-201.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-8A78B5CD7EAC — medium — unverified

net/textproto: golang: Golang net/textproto: Misleading error messages via input injection

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-42507.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-E7E03C983101 — medium — unverified

net/http: golang: golang: Cross-user response poisoning via desynchronized HTTP CONNECT connections

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56866, CWE-444.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-FF18E196EC29 — medium — unverified

net/http: golang.org/x/net/http2: golang: net/http: Denial of Service via HTTP/2 trailer header memory exhaustion

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78659, CWE-405.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-B9F06D29DABD — medium — unverified

net/http: golang: golang.org/x/net/http2: net/http: HTTP response smuggling via malformed HTTP/2 framing headers

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78660, CWE-444.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-034AB50B6E32 — medium — unverified

net/http: net/http/internal/http2: golang: golang.org/x/net/http2: golang: flow control limit bypass via double refund in HTTP/2 server

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-78663, CWE-675.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-386C19951B0F — medium — unverified

net/http: golang: net/http: HTTP request smuggling via improper handling of HTTP/1 CONNECT responses

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-94439, CWE-444.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-6B1A11578F75 — medium — unverified

net/textproto: mime/multipart: golang: golang: Denial of Service via memory limit bypass in multipart form parsing

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-94440, CWE-770.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-42833CDBC47D — medium — unverified

html/template: golang: golang: cross-site scripting via consecutive expressions in JavaScript template literals

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-94448, CWE-79.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-0C6C270B225E — medium — unverified

html/template: golang: html/template: Cross-site scripting via improper escaping of yield keyword

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-97030, CWE-79.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-2CA9B84C4C44 — medium — unverified

net/http: net/http/internal/http2: golang: golang.org/x/net/http2: net/http: Denial of Service via concurrent HPACK encoder modification

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-97032, CWE-362.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### RUNTIME-205629edb684 — medium — unverified

CSP: Failure to Define Directive with No Fallback

Location: `/sign-in`. Agent: E. Confidence: high.

Identifiers: CWE-693.

Evidence: Observed Content-Security-Policy: frame-ancestors 'self'. src/server.ts appFetch intentionally applies framing protection without a script/style policy; no XSS was reproduced.

Impact: A restrictive CSP would limit the impact of a separate injection defect. This scan did not establish such a defect or verify deployed CDN/Worker headers.

Remediation: Verify staging policy and design nonce-aware script restrictions compatible with TanStack bootstrap, Turnstile and PostHog before changing this policy.

Verification: ["Agent E manually reviewed the healthy isolated hosted-mode development instance on 2026-10-25.", "See security/reports/runtime-assessment.md for scope, evidence and limitations."]

### RUNTIME-c17fe683c4db — medium — unverified

CSP: Failure to Define Directive with No Fallback

Location: `/`. Agent: E. Confidence: high.

Identifiers: CWE-693.

Evidence: Observed Content-Security-Policy: frame-ancestors 'self'. src/server.ts appFetch intentionally applies framing protection without a script/style policy; no XSS was reproduced.

Impact: A restrictive CSP would limit the impact of a separate injection defect. This scan did not establish such a defect or verify deployed CDN/Worker headers.

Remediation: Verify staging policy and design nonce-aware script restrictions compatible with TanStack bootstrap, Turnstile and PostHog before changing this policy.

Verification: ["Agent E manually reviewed the healthy isolated hosted-mode development instance on 2026-10-25.", "See security/reports/runtime-assessment.md for scope, evidence and limitations."]

### RUNTIME-d8c9e775664a — medium — unverified

CSP: Failure to Define Directive with No Fallback

Location: `/.git/config`. Agent: E. Confidence: high.

Identifiers: CWE-693.

Evidence: Observed Content-Security-Policy: frame-ancestors 'self'. src/server.ts appFetch intentionally applies framing protection without a script/style policy; no XSS was reproduced.

Impact: A restrictive CSP would limit the impact of a separate injection defect. This scan did not establish such a defect or verify deployed CDN/Worker headers.

Remediation: Verify staging policy and design nonce-aware script restrictions compatible with TanStack bootstrap, Turnstile and PostHog before changing this policy.

Verification: ["Agent E manually reviewed the healthy isolated hosted-mode development instance on 2026-10-25.", "See security/reports/runtime-assessment.md for scope, evidence and limitations."]

### SEC-SECRET-ed800140741d — low — false_positive

Public PostHog project ingestion key used for opt-out self-host telemetry; this is not a personal, query, or management API credential.

Location: `scripts/selfhost-preflight.ts`. Agent: A. Confidence: high.

Identifiers: CWE-798.

Evidence: [{'scope': 'worktree', 'file': 'scripts/selfhost-preflight.ts', 'line': 17, 'commit': None, 'source_sha256': '4275f07625375195426050dc048262d09a0e63e20a647d9cc36d6989ba864360', 'secret': '[REDACTED]'}, {'scope': 'history', 'file': 'scripts/selfhost-preflight.ts', 'line': 17, 'commit': '625b76ebee0d2aca8bb6fb63bfa9fc1b9621d8e5', 'source_sha256': '4275f07625375195426050dc048262d09a0e63e20a647d9cc36d6989ba864360', 'secret': '[REDACTED]'}]

Impact: No credential exposure: inspected value is intentionally non-secret.

Remediation: Retain visible detection and exact-source review; re-review when source changes.

Verification: ["Inspected the public project-key prefix and capture-only usage in both telemetry implementations. No privileged PostHog API key is present."]

### SEC-SECRET-e50dce72533d — low — false_positive

Intentionally public OpenAI Apps ownership-verification challenge, served by its well-known route; not an authentication credential.

Location: `src/routes/[.well-known]/openai-apps-challenge.ts`. Agent: A. Confidence: high.

Identifiers: CWE-798.

Evidence: [{'scope': 'worktree', 'file': 'src/routes/[.well-known]/openai-apps-challenge.ts', 'line': 4, 'commit': None, 'source_sha256': '623fa0bd79cb9e0d312568aadf9944e173de9d1e8b55d95029924b98c99e270b', 'secret': '[REDACTED]'}, {'scope': 'history', 'file': 'src/routes/[.well-known]/openai-apps-challenge.ts', 'line': 4, 'commit': '7a0ab0de2c81f118c1686e942222bfe5ba2b59d8', 'source_sha256': '623fa0bd79cb9e0d312568aadf9944e173de9d1e8b55d95029924b98c99e270b', 'secret': '[REDACTED]'}]

Impact: No credential exposure: inspected value is intentionally non-secret.

Remediation: Retain visible detection and exact-source review; re-review when source changes.

Verification: ["The source explicitly documents and returns this public challenge. Its purpose requires public disclosure and does not authorize API access."]

### SEC-SECRET-42618ad530a7 — low — false_positive

Synthetic Stripe token fixture; suffix is an ordered hexadecimal sequence or an alphabet pattern with a dummy numeric prefix. Provider calls are mocked in the tests.

Location: `src/server/features/growth/tenancy-test-calls-accessibility.ts`. Agent: A. Confidence: high.

Identifiers: CWE-798.

Evidence: [{'scope': 'worktree', 'file': 'src/server/features/growth/tenancy-test-calls-accessibility.ts', 'line': 66, 'commit': None, 'source_sha256': '988cba96a82a2662972eb574f085ab92b31557dfcf03a8b2e506cf5acc75400d', 'secret': '[REDACTED]'}, {'scope': 'history', 'file': 'src/server/features/growth/tenancy-test-calls-accessibility.ts', 'line': 57, 'commit': '89481979fb121c06ee81d4d0842cc23b85563dfc', 'source_sha256': 'cb1d29948f1970b4e64e898ce6ddebd29f25fdf998cd4a634d49847558d6ce26', 'secret': '[REDACTED]'}]

Impact: No credential exposure: inspected value is intentionally non-secret.

Remediation: Retain visible detection and exact-source review; re-review when source changes.

Verification: ["Inspected the exact source and programmatically verified the synthetic suffix pattern without disclosing the value; test-only call paths and mocked fetch do not authenticate to Stripe."]

### SEC-SECRET-585dff1dc5fe — low — false_positive

Explicitly named publishing test secret is a descriptive fixture string used by encryption tests, not a deployed credential.

Location: `src/server/features/publishing/publishing-test-fixtures.ts`. Agent: A. Confidence: high.

Identifiers: CWE-798.

Evidence: [{'scope': 'worktree', 'file': 'src/server/features/publishing/publishing-test-fixtures.ts', 'line': 12, 'commit': None, 'source_sha256': 'aa23e0cd379ef9481fe91c78f5311295801506cd083825cab8442b4de756254d', 'secret': '[REDACTED]'}, {'scope': 'history', 'file': 'src/server/features/publishing/publishing-test-fixtures.ts', 'line': 12, 'commit': '60d84c8bba009c78f7167f37a52083c15c907fcb', 'source_sha256': '45a079e4ec7d46d3bcd7b6b897d403ee73ff54f7c395ba6e1084852e90ef48d4', 'secret': '[REDACTED]'}]

Impact: No credential exposure: inspected value is intentionally non-secret.

Remediation: Retain visible detection and exact-source review; re-review when source changes.

Verification: ["Inspected fixture declaration and test consumers; the literal identifies itself as a test fixture and no production configuration imports it."]

### SEC-SECRET-6819154821f2 — low — false_positive

Synthetic Stripe token fixture; suffix is an ordered hexadecimal sequence or an alphabet pattern with a dummy numeric prefix. Provider calls are mocked in the tests.

Location: `src/server/features/revenue/revenueSync.test.ts`. Agent: A. Confidence: high.

Identifiers: CWE-798.

Evidence: [{'scope': 'worktree', 'file': 'src/server/features/revenue/revenueSync.test.ts', 'line': 99, 'commit': None, 'source_sha256': '9a1d3d1096dda4fc0fd4e7e557809fc0872b2714f61ae53b3ec8e7b461e715d7', 'secret': '[REDACTED]'}, {'scope': 'history', 'file': 'src/server/features/revenue/revenueSync.test.ts', 'line': 99, 'commit': '4ab55fc6209c50ae6bb2c8f761aee179cee61289', 'source_sha256': '9a1d3d1096dda4fc0fd4e7e557809fc0872b2714f61ae53b3ec8e7b461e715d7', 'secret': '[REDACTED]'}]

Impact: No credential exposure: inspected value is intentionally non-secret.

Remediation: Retain visible detection and exact-source review; re-review when source changes.

Verification: ["Inspected the exact source and programmatically verified the synthetic suffix pattern without disclosing the value; test-only call paths and mocked fetch do not authenticate to Stripe."]

### SEC-SECRET-53dc10379db9 — low — false_positive

Synthetic Stripe token fixture; suffix is an ordered hexadecimal sequence or an alphabet pattern with a dummy numeric prefix. Provider calls are mocked in the tests.

Location: `src/server/features/revenue/RevenueConnectionService.test.ts`. Agent: A. Confidence: high.

Identifiers: CWE-798.

Evidence: [{'scope': 'worktree', 'file': 'src/server/features/revenue/RevenueConnectionService.test.ts', 'line': 39, 'commit': None, 'source_sha256': '2609d52d425b8eb6e3afe01e893a1799bf245c27fd8902eaf14dbd002f8070c2', 'secret': '[REDACTED]'}, {'scope': 'worktree', 'file': 'src/server/features/revenue/RevenueConnectionService.test.ts', 'line': 74, 'commit': None, 'source_sha256': '2609d52d425b8eb6e3afe01e893a1799bf245c27fd8902eaf14dbd002f8070c2', 'secret': '[REDACTED]'}, {'scope': 'history', 'file': 'src/server/features/revenue/RevenueConnectionService.test.ts', 'line': 34, 'commit': '89481979fb121c06ee81d4d0842cc23b85563dfc', 'source_sha256': '6ea7b32af7543d6a9f0994bae4650d96de1be604b19979fa9e2e0a394ef8a645', 'secret': '[REDACTED]'}, {'scope': 'history', 'file': 'src/server/features/revenue/RevenueConnectionService.test.ts', 'line': 69, 'commit': '89481979fb121c06ee81d4d0842cc23b85563dfc', 'source_sha256': '6ea7b32af7543d6a9f0994bae4650d96de1be604b19979fa9e2e0a394ef8a645', 'secret': '[REDACTED]'}]

Impact: No credential exposure: inspected value is intentionally non-secret.

Remediation: Retain visible detection and exact-source review; re-review when source changes.

Verification: ["Inspected the exact source and programmatically verified the synthetic suffix pattern without disclosing the value; test-only call paths and mocked fetch do not authenticate to Stripe."]

### SEC-SECRET-bfda0d1995ee — low — false_positive

Public PostHog project ingestion key used for opt-out self-host telemetry; this is not a personal, query, or management API credential.

Location: `src/server/lib/self-host-telemetry.ts`. Agent: A. Confidence: high.

Identifiers: CWE-798.

Evidence: [{'scope': 'worktree', 'file': 'src/server/lib/self-host-telemetry.ts', 'line': 24, 'commit': None, 'source_sha256': 'f0c3548f6a7b481349b3f9cfa3f2aa733dca94cb6f7b2625540bc60c2df992e6', 'secret': '[REDACTED]'}, {'scope': 'history', 'file': 'src/server/lib/self-host-telemetry.ts', 'line': 22, 'commit': '1398605ddcdd7dbf51176eae3d92611d8db64a84', 'source_sha256': '9136d3dbb9584f4e9b3405a367347bc6f97af1c37a3093526e833907256ec15c', 'secret': '[REDACTED]'}]

Impact: No credential exposure: inspected value is intentionally non-secret.

Remediation: Retain visible detection and exact-source review; re-review when source changes.

Verification: ["Inspected the public project-key prefix and capture-only usage in both telemetry implementations. No privileged PostHog API key is present."]

### SEC-SECRET-9add9fb048a2 — low — false_positive

Documented Postgres connection example uses placeholder user/password and a placeholder host, not a deployed database credential.

Location: `docs/maintainers/runbooks/d1-to-postgres-simple.md`. Agent: A. Confidence: high.

Identifiers: CWE-798.

Evidence: [{'scope': 'worktree', 'file': 'docs/maintainers/runbooks/d1-to-postgres-simple.md', 'line': 26, 'commit': None, 'source_sha256': '03279193de6f9700f89e7487f413e3877e4e9aa1f123c4e343a75909de688d46', 'secret': '[REDACTED]'}, {'scope': 'history', 'file': 'runbooks/d1-to-postgres-simple.md', 'line': 21, 'commit': '19a4bc6585f6bb0cd9b5eace9e4ec16e4927e70e', 'source_sha256': '807410267dc93c7d475d6ea56e870af64e07a2d8051af4725fa18f755f7907a3', 'secret': '[REDACTED]'}]

Impact: No credential exposure: inspected value is intentionally non-secret.

Remediation: Retain visible detection and exact-source review; re-review when source changes.

Verification: ["Parsed the detected URI privately: host, username, and password are literal documentation placeholders. Examples occur in comments/runbooks."]

### SEC-SECRET-0625c4c5451d — low — false_positive

Documented Postgres connection example uses placeholder user/password and a placeholder host, not a deployed database credential.

Location: `docs/maintainers/runbooks/d1-to-postgres-detailed.md`. Agent: A. Confidence: high.

Identifiers: CWE-798.

Evidence: [{'scope': 'worktree', 'file': 'docs/maintainers/runbooks/d1-to-postgres-detailed.md', 'line': 63, 'commit': None, 'source_sha256': '2947e09830352125f9a62be2b4aaabee24a114f66e23d424d62999f2c8ad0b14', 'secret': '[REDACTED]'}, {'scope': 'history', 'file': 'runbooks/d1-to-postgres-detailed.md', 'line': 58, 'commit': '19a4bc6585f6bb0cd9b5eace9e4ec16e4927e70e', 'source_sha256': '1b1f9ad14cce514a42c44eb2ee063bfbab684c527d52f775d46d6a01e6c00409', 'secret': '[REDACTED]'}]

Impact: No credential exposure: inspected value is intentionally non-secret.

Remediation: Retain visible detection and exact-source review; re-review when source changes.

Verification: ["Parsed the detected URI privately: host, username, and password are literal documentation placeholders. Examples occur in comments/runbooks."]

### SEC-SECRET-b724811464de — low — false_positive

Documented Postgres connection example uses placeholder user/password and a placeholder host, not a deployed database credential.

Location: `scripts/migrate-d1-to-postgres.ts`. Agent: A. Confidence: high.

Identifiers: CWE-798.

Evidence: [{'scope': 'worktree', 'file': 'scripts/migrate-d1-to-postgres.ts', 'line': 42, 'commit': None, 'source_sha256': '9fc791a8324d0bd2d6d31da202784e964bcf714cdd153ba0caa92780566141c4', 'secret': '[REDACTED]'}, {'scope': 'history', 'file': 'scripts/migrate-d1-to-postgres.ts', 'line': 42, 'commit': '19a4bc6585f6bb0cd9b5eace9e4ec16e4927e70e', 'source_sha256': 'c5932efd3bb32906727074a21eb15b2066247ce7d9576c4aeadf56e5eb370ed4', 'secret': '[REDACTED]'}]

Impact: No credential exposure: inspected value is intentionally non-secret.

Remediation: Retain visible detection and exact-source review; re-review when source changes.

Verification: ["Parsed the detected URI privately: host, username, and password are literal documentation placeholders. Examples occur in comments/runbooks."]

### SEC-SECRET-4fd5ea18a08b — low — false_positive

Deliberately credential-bearing sample URL in an input-validation regression test, with placeholder username/password and an example host.

Location: `src/server/features/opportunities/services/detectOpportunities.test.ts`. Agent: A. Confidence: high.

Identifiers: CWE-798.

Evidence: [{'scope': 'worktree', 'file': 'src/server/features/opportunities/services/detectOpportunities.test.ts', 'line': 148, 'commit': None, 'source_sha256': '103fd3582c14b23c233e1e183b1540a0e228405817a4dd9f1137e4c3e936a269', 'secret': '[REDACTED]'}, {'scope': 'history', 'file': 'src/server/features/opportunities/services/detectOpportunities.test.ts', 'line': 173, 'commit': '5a77de9b9a4963d9d3c486fe36d2c1edb0a32466', 'source_sha256': 'fe4adea14dc895ab8796f5d493330c92a3530d84a73897da3c6c9d59bdb7c6c4', 'secret': '[REDACTED]'}]

Impact: No credential exposure: inspected value is intentionally non-secret.

Remediation: Retain visible detection and exact-source review; re-review when source changes.

Verification: ["Parsed the URI privately and inspected the surrounding rejected-input test. The string is supplied to URL validation, not used for provider authentication."]

### SEC-SECRET-5ab0cce4593b — low — false_positive

Deliberately credential-bearing sample URL in an input-validation regression test, with placeholder username/password and an example host.

Location: `src/server/features/publishing/nextMetadata.test.ts`. Agent: A. Confidence: high.

Identifiers: CWE-798.

Evidence: [{'scope': 'worktree', 'file': 'src/server/features/publishing/nextMetadata.test.ts', 'line': 273, 'commit': None, 'source_sha256': '42e8436c9eb5fdeb32c6614c6fe8b30d4438cd14c7aea53e63835c9874f3925b', 'secret': '[REDACTED]'}, {'scope': 'history', 'file': 'src/server/features/publishing/nextMetadata.test.ts', 'line': 260, 'commit': '46abb9e606afe8bfe2c9a2ef3faa7b1b9cd0a6e0', 'source_sha256': '9d8d639754cdc70140320a4fd7b65e940221a8b00d44e8a43b100b166ce3c394', 'secret': '[REDACTED]'}]

Impact: No credential exposure: inspected value is intentionally non-secret.

Remediation: Retain visible detection and exact-source review; re-review when source changes.

Verification: ["Parsed the URI privately and inspected the surrounding rejected-input test. The string is supplied to URL validation, not used for provider authentication."]

### SEC-SECRET-88a43dbe33b0 — low — false_positive

Deliberately credential-bearing sample URL in an input-validation regression test, with placeholder username/password and an example host.

Location: `src/server/lib/audit/rendered-page.test.ts`. Agent: A. Confidence: high.

Identifiers: CWE-798.

Evidence: [{'scope': 'worktree', 'file': 'src/server/lib/audit/rendered-page.test.ts', 'line': 215, 'commit': None, 'source_sha256': 'e47de8ea0c9e645c37673b5fc68ef123fdee03465402059635e72b1bd7ca0bd2', 'secret': '[REDACTED]'}, {'scope': 'history', 'file': 'src/server/lib/audit/rendered-page.test.ts', 'line': 215, 'commit': '564f21d0a84d08a518a92dcd0ae061e3d48a11db', 'source_sha256': 'e47de8ea0c9e645c37673b5fc68ef123fdee03465402059635e72b1bd7ca0bd2', 'secret': '[REDACTED]'}]

Impact: No credential exposure: inspected value is intentionally non-secret.

Remediation: Retain visible detection and exact-source review; re-review when source changes.

Verification: ["Parsed the URI privately and inspected the surrounding rejected-input test. The string is supplied to URL validation, not used for provider authentication."]

### SEC-SECRET-2ef243460732 — low — false_positive

Deliberately credential-bearing sample URL in an input-validation regression test, with placeholder username/password and an example host.

Location: `src/shared/safe-url.test.ts`. Agent: A. Confidence: high.

Identifiers: CWE-798.

Evidence: [{'scope': 'worktree', 'file': 'src/shared/safe-url.test.ts', 'line': 21, 'commit': None, 'source_sha256': '1a1c52ec2d506faf2ac8783c6ab99cd7a92f48e1792c9eff0b8c73dd3fac96fe', 'secret': '[REDACTED]'}, {'scope': 'history', 'file': 'src/server/features/ai-search/safeUrl.test.ts', 'line': 23, 'commit': 'faf7a294a3d0b51e5990929b8cdb4d5e95ae2ba0', 'source_sha256': '17dc868151fccf6d7cbef42f85f1a4323b18eff78efff75aa9b6f97181b4708e', 'secret': '[REDACTED]'}]

Impact: No credential exposure: inspected value is intentionally non-secret.

Remediation: Retain visible detection and exact-source review; re-review when source changes.

Verification: ["Parsed the URI privately and inspected the surrounding rejected-input test. The string is supplied to URL validation, not used for provider authentication."]

### SEC-SECRET-48dc402ce705 — low — false_positive

Deliberately credential-bearing sample URL in an input-validation regression test, with placeholder username/password and an example host.

Location: `src/server/lib/dataforseoBacklinks.test.ts`. Agent: A. Confidence: high.

Identifiers: CWE-798.

Evidence: [{'scope': 'history', 'file': 'src/server/lib/dataforseoBacklinks.test.ts', 'line': 78, 'commit': '8405564925362a789abbed50b1e54191a8bae399', 'source_sha256': '4b63a482efb0de61cd0b7427c7adc50057520be03d927d299d1ec4751d074dc4', 'secret': '[REDACTED]'}]

Impact: No credential exposure: inspected value is intentionally non-secret.

Remediation: Retain visible detection and exact-source review; re-review when source changes.

Verification: ["Parsed the URI privately and inspected the surrounding rejected-input test. The string is supplied to URL validation, not used for provider authentication."]

### SEC-B-ba22244502ff — low — false_positive

Reviewed js-open-redirect-from-function audit match.

Location: `src/client/features/integrations/googleLinkError.test.ts:15`. Agent: B. Confidence: high.

Identifiers: CWE-601: URL Redirection to Untrusted Site ('Open Redirect').

Evidence: Test-only fixture or local test harness; the matched values are synthetic and never run as a deployed request handler.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-f462465a39f6 — low — false_positive

Reviewed js-open-redirect-from-function audit match.

Location: `src/client/features/integrations/startGoogleLink.ts:57`. Agent: B. Confidence: high.

Identifiers: CWE-601: URL Redirection to Untrusted Site ('Open Redirect').

Evidence: Navigation uses the authenticated server OAuth-start result. googleOAuth.ts constructs the provider authorization URL with a fixed Google origin and signed single-use state; caller callback paths do not replace that origin.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-b4d5ca569e98 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/email/loops-client.ts:112`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-50dfcb76ac40 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/features/ai-search/services/brandLookup.ts:151`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-97e6d0115e85 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/features/ai-search/services/brandLookup.ts:358`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-cea4388aed21 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/features/ai-search/services/brandLookup.ts:388`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-70bd45d08c79 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/features/ai-search/services/promptExplorer.ts:161`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-b17c944f1c42 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/features/ai-search/services/promptExplorer.ts:351`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-d38bddbc2ad5 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/features/ai-visibility/services/aiVisibilityCollection.ts:161`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-7fcf1cfad85f — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/features/ai-visibility/services/aiVisibilityCollection.ts:212`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-b5d940675318 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/features/ai-visibility/services/aiVisibilityCollection.ts:295`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-1886eb85b2f2 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/features/ai-visibility/services/websiteTrackingSetup.ts:72`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-e5d47194dbce — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/features/audit/services/AuditService.ts:315`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-b2bd7bf9b7c4 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/features/audit/services/AuditService.ts:328`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-b5f9f3a6e2d5 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/features/audit/services/auditReconciler.ts:127`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-a1ace81f2fd4 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/features/rank-tracking/services/scheduledRankChecks.ts:132`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-71feaf0361ab — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/features/rank-tracking/services/scheduledRankChecks.ts:189`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-5f7b3e44172e — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/features/rank-tracking/services/scheduledRankChecks.ts:221`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-fc2472c2086c — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/lib/chatAgent.ts:19`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-9e02d8b40fe6 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/lib/dataforseo/envelope.ts:346`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-e6b2a8c27009 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/lib/dataforseo/llm-models.ts:128`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-e58a0a7435df — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/mcp/instrumentation.ts:187`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-cbf75bbe3ce6 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/workflows/AiVisibilityWorkflow.ts:87`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-d10a98147ae1 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/workflows/AiVisibilityWorkflow.ts:105`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-77fe24330ac3 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/workflows/AiVisibilityWorkflow.ts:121`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-b8520384f37a — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/workflows/AiVisibilityWorkflow.ts:156`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-65623da262a0 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/workflows/RankCheckWorkflow.ts:416`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-8f19738bf2df — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/workflows/SiteAuditWorkflow.ts:102`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-bdb6dfccc693 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/workflows/rankCheckPaths.ts:180`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-44464e173528 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/workflows/rankCheckPaths.ts:295`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-f382bfce4436 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/workflows/rankCheckPaths.ts:392`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-743b6b5d86c1 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/workflows/rankCheckPaths.ts:441`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-0c746d91a55b — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/server/workflows/site-audit-workflow-helpers.ts:247`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-ab8e3c54a3ec — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `src/serverFunctions/rank-tracking.ts:196`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-ef2974c79d0d — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `web/src/lib/free-tools/server.ts:241`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-2c84e0bc6d74 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `web/src/routes/api/competitor-keyword-finder.ts:89`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-7a834a3d3028 — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `web/src/routes/api/domain-age-checker.ts:160`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-af1151539eef — low — false_positive

Reviewed unsafe-formatstring audit match.

Location: `web/src/routes/api/keyword-generator.ts:87`. Agent: B. Confidence: high.

Identifiers: CWE-134: Use of Externally-Controlled Format String.

Evidence: Reviewed console logging call. Interpolated values are bounded identifiers, fixed provider/tool names, or normalized URLs; JavaScript console formatting is not a code execution, SQL, or native-memory format sink.

Impact: No exploitable security defect established at this exact reviewed location.

Remediation: Retain the existing control; re-review when the source changes.

Verification: ["2026-10-25: source-to-sink review; decision bound to exact source-file SHA-256."]

### SEC-B-003 — low — fixed

Draft release notes used a predictable global temporary filename and followed pre-existing symlinks.

Location: `scripts/release-notes.mjs:302`. Agent: B. Confidence: high.

Identifiers: CWE-377, CWE-59.

Evidence: CodeQL js/insecure-temporary-file reported the Date.now-based filename. A subprocess regression pre-created a symlink at that predictable name; original CLI overwrote the synthetic victim. Git and gh were local stubs and no release was published.

Impact: A different local user able to precreate the guessed temporary path could cause an operator running --draft to overwrite a writable file or alter temporary release-note handling.

Remediation: Create a random private directory, exclusively write the note file with mode 0600, and remove the directory in a finally block.

Verification: ["2026-10-25: regression failed before patch by observing victim content replaced; passes after with unchanged victim,0700 directory, 0600 file, and cleanup.", "2026-10-25: fresh CodeQL database and security-extended rescan no longer reports js/insecure-temporary-file."]

### DEP-3a8b6d1e62d0 — low — fixed

fast-uri vulnerable to improper path equivalence in relative reference normalization

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-110095, CWE-41, GHSA-xhq7-xmqj-769h.

Evidence: ['Lockfile resolves fast-uri@3.1.8; advisory affected range: >=3.0.0 <3.1.9.', '.>shadcn>@dotenvx/dotenvx>conf>ajv>fast-uri']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 3.1.9 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-49d6482c98ea — low — fixed

DOMPurify: SMIL attributeName=href guard is skipped when PARSER_MEDIA_TYPE is application/xhtml+xml

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CWE-79, GHSA-c6gr-qvv4-5v3f.

Evidence: ['Lockfile resolves dompurify@3.4.16; advisory affected range: <=3.4.16.', '.>posthog-js>dompurify']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 3.4.17 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-64761b4c74d8 — low — fixed

Vite: Cross origin script execution through Vite custom middleware

Location: `./pnpm-lock.yaml, web/pnpm-lock.yaml, tests/badseo/pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-112945, CWE-80, GHSA-9jrq-w75r-8gcw.

Evidence: ['Lockfile resolves vite@7.3.6; advisory affected range: >=7.0.0 <=7.3.6.', '.>vite']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 7.3.7 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### DEP-f1e74054ba71 — low — fixed

fast-uri vulnerable to scheme injection via an unescaped first-segment colon in suffix references

Location: `./pnpm-lock.yaml`. Agent: C. Confidence: high (affected version); runtime exploitability depends on the call path.

Identifiers: CVE-2026-110725, CWE-116, CWE-41, GHSA-333x-w4r6-6crp.

Evidence: ['Lockfile resolves fast-uri@3.1.8; advisory affected range: >=3.0.0 <3.1.9.', '.>shadcn>@dotenvx/dotenvx>conf>ajv>fast-uri']

Impact: An installed dependency version is affected by the advisory. This proves dependency exposure, not unauthenticated production exploitability; developer-only paths require local/tool input.

Remediation: Upgrade to version 3.1.9 or later

Verification: ["All affected workspaces completed pnpm audit after the lockfile update; the original package/version/advisory is no longer reported. Application regression/build checks are recorded separately in remediation.md."]

### INFRA-7420512156F2 — low — unverified

It was found that apt-key in apt, all versions, do not correctly valid ...

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2011-3374, CWE-347.

Evidence: Scanner matched apt@2.6.1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-F387FAAEB077 — low — unverified

[Privilege escalation possible to other user than root]

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: TEMP-0841856-B18BAF.

Evidence: Scanner matched bash@5.2.15-2+b13 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-CD3990E17171 — low — unverified

util-linux: partial disclosure of arbitrary files in chfn and chsh when compiled with libreadline

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2022-0563, CWE-209.

Evidence: Scanner matched bsdutils@1:2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-D0B2F716DE5E — low — unverified

util-linux: util-linux: Heap buffer overread in setpwnam() when processing 256-byte usernames

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-14104, CWE-125.

Evidence: Scanner matched bsdutils@1:2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-9B56E10DB926 — low — unverified

coreutils: Non-privileged session can escape to the parent session in chroot

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2016-2781, CWE-20.

Evidence: Scanner matched coreutils@9.1-1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-CA6FECE8BFA7 — low — unverified

coreutils: race condition vulnerability in chown and chgrp

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2017-18018, CWE-362.

Evidence: Scanner matched coreutils@9.1-1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-3A5D50C6DF13 — low — unverified

coreutils: Heap Buffer Under-Read in GNU Coreutils sort via Key Specification

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-5278, CWE-121.

Evidence: Scanner matched coreutils@9.1-1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-DDE3DD6537A3 — low — unverified

coreutils: GNU coreutils uniq: Denial of Service and information disclosure via out-of-bounds read with multibyte input

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56391, CWE-125.

Evidence: Scanner matched coreutils@9.1-1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-84DCBE525E9E — low — unverified

coreutils: GNU coreutils unexpand: Denial of Service via crafted tab stop values

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56392, CWE-122.

Evidence: Scanner matched coreutils@9.1-1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-0A325F98D838 — low — unverified

dash: dash: Super-polynomial backtracking in pmatch when libc fnmatch is disabled

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-102473, CWE-1333.

Evidence: Scanner matched dash@0.5.12-2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-C9CDD8F2086F — low — unverified

dash: dash: Heap out-of-bounds write in conv_escape via undersized Unicode escape reservation

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-102474, CWE-787.

Evidence: Scanner matched dash@0.5.12-2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-C6556005368B — low — unverified

diffutils: heap‑based buffer overflow due to multiple signed integer overflows in line‑mapping calculations

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-53910, CWE-190.

Evidence: Scanner matched diffutils@1:3.8-4 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-A17923EEB5F6 — low — unverified

binutils: libiberty/rust-demangle.c in GNU GCC 11.2 allows stack exhaustion in demangle_const

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2022-27943, CWE-674.

Evidence: Scanner matched gcc-12-base@12.2.0-14+deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-65FAA39EC5AD — low — unverified

gnupg: denial of service issue (resource consumption) using compressed packets

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2022-3219, CWE-787.

Evidence: Scanner matched gpgv@2.2.40-1.1+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-951C5F63D0CA — low — unverified

gnupg2: gnupg: Arbitrary file overwrite via symlink traversal in gpgtar

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-105712, CWE-61.

Evidence: Scanner matched gpgv@2.2.40-1.1+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-31AE3EB26C63 — low — unverified

GnuPG: Incorrect cryptographic message parsing

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-57062, CWE-1284.

Evidence: Scanner matched gpgv@2.2.40-1.1+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-9B15D2C5A01C — low — unverified

It was found that apt-key in apt, all versions, do not correctly valid ...

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2011-3374, CWE-347.

Evidence: Scanner matched libapt-pkg6.0@2.6.1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-FE9C9BB77028 — low — unverified

util-linux: partial disclosure of arbitrary files in chfn and chsh when compiled with libreadline

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2022-0563, CWE-209.

Evidence: Scanner matched libblkid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-A115A4079938 — low — unverified

util-linux: util-linux: Heap buffer overread in setpwnam() when processing 256-byte usernames

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-14104, CWE-125.

Evidence: Scanner matched libblkid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-85772BA41A27 — low — unverified

glibc: glob implementation can cause excessive CPU and memory consumption due to crafted glob expressions

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2010-4756, CWE-399.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-C5BEF37C2540 — low — unverified

glibc: uncontrolled recursion in function check_dst_limits_calc_pos_1 in posix/regexec.c

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2018-20796, CWE-674.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-02DB10BD39DD — low — unverified

glibc: stack guard protection bypass

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2019-1010022, CWE-119.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-EF0A744207C8 — low — unverified

glibc: running ldd on malicious ELF leads to code execution because of wrong size computation

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2019-1010023.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-145C5CC2F6CC — low — unverified

glibc: ASLR bypass using cache of thread stack and heap

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2019-1010024, CWE-200.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-F2B664348946 — low — unverified

glibc: information disclosure of heap addresses of pthread_created thread

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2019-1010025, CWE-330.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-12AC8694C07C — low — unverified

glibc: uncontrolled recursion in function check_dst_limits_calc_pos_1 in posix/regexec.c

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2019-9192, CWE-674.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-0545EB0FC1AA — low — unverified

glibc: glibc: Denial of Service via out-of-bounds read in strncasecmp

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-97399, CWE-126.

Evidence: Scanner matched libc-bin@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-3F0C5CD5DD0C — low — unverified

glibc: glob implementation can cause excessive CPU and memory consumption due to crafted glob expressions

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2010-4756, CWE-399.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-6503CEF8691B — low — unverified

glibc: uncontrolled recursion in function check_dst_limits_calc_pos_1 in posix/regexec.c

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2018-20796, CWE-674.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-AF65F04AED52 — low — unverified

glibc: stack guard protection bypass

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2019-1010022, CWE-119.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-D786C027729B — low — unverified

glibc: running ldd on malicious ELF leads to code execution because of wrong size computation

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2019-1010023.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-448C92B18117 — low — unverified

glibc: ASLR bypass using cache of thread stack and heap

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2019-1010024, CWE-200.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-934FF7BD9C47 — low — unverified

glibc: information disclosure of heap addresses of pthread_created thread

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2019-1010025, CWE-330.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-BE758789A550 — low — unverified

glibc: uncontrolled recursion in function check_dst_limits_calc_pos_1 in posix/regexec.c

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2019-9192, CWE-674.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-5E8192B7E59C — low — unverified

glibc: glibc: Denial of Service via out-of-bounds read in strncasecmp

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-97399, CWE-126.

Evidence: Scanner matched libc6@2.36-9+deb12u14 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-D9557148F40B — low — unverified

binutils: libiberty/rust-demangle.c in GNU GCC 11.2 allows stack exhaustion in demangle_const

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2022-27943, CWE-674.

Evidence: Scanner matched libgcc-s1@12.2.0-14+deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-0C77BCABC830 — low — unverified

libgcrypt: ElGamal implementation doesn't have semantic security due to incorrectly encoded plaintexts possibly allowing to obtain sensitive information

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2018-6829, CWE-327.

Evidence: Scanner matched libgcrypt20@1.10.1-3+deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-52AF40D62575 — low — unverified

libgcrypt: vulnerable to Marvin Attack

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2024-2236, CWE-385.

Evidence: Scanner matched libgcrypt20@1.10.1-3+deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-456FE9280D2C — low — unverified

HTTPS: block-wise chosen-plaintext attack against SSL/TLS (BEAST)

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2011-3389, CWE-326.

Evidence: Scanner matched libgnutls30@3.7.9-2+deb12u7 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-8A30FC6658D7 — low — unverified

gnutls: gnutls: Information disclosure via contradictory Key Usage and Extended Key Usage extensions

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-67693, CWE-367.

Evidence: Scanner matched libgnutls30@3.7.9-2+deb12u7 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-FEB17C4DD87C — low — unverified

gnutls: gnutls: Information disclosure via hostname verification bypass

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-88647, CWE-297.

Evidence: Scanner matched libgnutls30@3.7.9-2+deb12u7 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-912339BF92D2 — low — unverified

gnutls: gnutls: Cross-domain certificate restriction bypass via incomplete X.509 validation

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-88648.

Evidence: Scanner matched libgnutls30@3.7.9-2+deb12u7 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-2D95FB18EAE8 — low — unverified

gnutls: gnutls: legitimate user certificates incorrectly rejected causing denial of service

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-95184, CWE-400.

Evidence: Scanner matched libgnutls30@3.7.9-2+deb12u7 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-3B4DB97B4469 — low — unverified

gnutls: gnutls: legitimate CA certificates incorrectly rejected causing denial of service

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-95209, CWE-400.

Evidence: Scanner matched libgnutls30@3.7.9-2+deb12u7 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-B436A850DE2A — low — unverified

gnutls: gnutls: certificates with invalid extensions incorrectly accepted

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-95210, CWE-295.

Evidence: Scanner matched libgnutls30@3.7.9-2+deb12u7 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-8C01D992B268 — low — unverified

util-linux: partial disclosure of arbitrary files in chfn and chsh when compiled with libreadline

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2022-0563, CWE-209.

Evidence: Scanner matched libmount1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-CE630E443339 — low — unverified

util-linux: util-linux: Heap buffer overread in setpwnam() when processing 256-byte usernames

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-14104, CWE-125.

Evidence: Scanner matched libmount1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-FA75D1B86DA1 — low — unverified

util-linux: partial disclosure of arbitrary files in chfn and chsh when compiled with libreadline

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2022-0563, CWE-209.

Evidence: Scanner matched libsmartcols1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-FB13052D2976 — low — unverified

util-linux: util-linux: Heap buffer overread in setpwnam() when processing 256-byte usernames

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-14104, CWE-125.

Evidence: Scanner matched libsmartcols1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-DA80405FDBAF — low — unverified

OpenSSL 3.0.0 through 3.3.2 on the PowerPC architecture is vulnerable  ...

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-27587, CWE-385.

Evidence: Scanner matched libssl3@3.0.22-1~deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-E46C2EA6DE3B — low — unverified

openssl: openssl: Denial of Service via excessive memory allocation in CRL distribution point processing

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-35189, CWE-770.

Evidence: Scanner matched libssl3@3.0.22-1~deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-EAABE9041A8F — low — unverified

binutils: libiberty/rust-demangle.c in GNU GCC 11.2 allows stack exhaustion in demangle_const

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2022-27943, CWE-674.

Evidence: Scanner matched libstdc++6@12.2.0-14+deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-D6BD0CB9724D — low — unverified

systemd: TOCTOU race condition when updating file permissions and SELinux security contexts

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2013-4392, CWE-59.

Evidence: Scanner matched libsystemd0@252.39-1~deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-3D29841F00B4 — low — unverified

An issue was discovered in systemd 253. An attacker can modify a seale ...

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2023-31437, CWE-354.

Evidence: Scanner matched libsystemd0@252.39-1~deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-6C8C1098B912 — low — unverified

An issue was discovered in systemd 253. An attacker can truncate a sea ...

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2023-31438, CWE-354.

Evidence: Scanner matched libsystemd0@252.39-1~deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-30894AEB3778 — low — unverified

An issue was discovered in systemd 253. An attacker can modify the con ...

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2023-31439, CWE-354.

Evidence: Scanner matched libsystemd0@252.39-1~deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-9686202E1B29 — low — unverified

systemd: systemd-journald: Unintended output to user terminals via logger command

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-40228, CWE-669.

Evidence: Scanner matched libsystemd0@252.39-1~deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-49FF74554308 — low — unverified

libtasn1: libtasn1: Denial of Service via stack-based buffer overflow in asn1_expend_octet_string

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-13151, CWE-787.

Evidence: Scanner matched libtasn1-6@4.19.0-2+deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-284105A11EFC — low — unverified

gnu-ncurses: ncurses Stack Buffer Overflow

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-6141, CWE-119, CWE-121.

Evidence: Scanner matched libtinfo6@6.4-4 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-D6E67A94CC5D — low — unverified

systemd: TOCTOU race condition when updating file permissions and SELinux security contexts

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2013-4392, CWE-59.

Evidence: Scanner matched libudev1@252.39-1~deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-C5E7088AC76A — low — unverified

An issue was discovered in systemd 253. An attacker can modify a seale ...

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2023-31437, CWE-354.

Evidence: Scanner matched libudev1@252.39-1~deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-A02712E2A657 — low — unverified

An issue was discovered in systemd 253. An attacker can truncate a sea ...

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2023-31438, CWE-354.

Evidence: Scanner matched libudev1@252.39-1~deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-E740D49014D9 — low — unverified

An issue was discovered in systemd 253. An attacker can modify the con ...

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2023-31439, CWE-354.

Evidence: Scanner matched libudev1@252.39-1~deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-06190183CFCC — low — unverified

systemd: systemd-journald: Unintended output to user terminals via logger command

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-40228, CWE-669.

Evidence: Scanner matched libudev1@252.39-1~deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-93F59AB1EF0F — low — unverified

util-linux: partial disclosure of arbitrary files in chfn and chsh when compiled with libreadline

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2022-0563, CWE-209.

Evidence: Scanner matched libuuid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-70A128B9A5A6 — low — unverified

util-linux: util-linux: Heap buffer overread in setpwnam() when processing 256-byte usernames

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-14104, CWE-125.

Evidence: Scanner matched libuuid1@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-F7A4C5C4269A — low — unverified

initscripts in rPath Linux 1 sets insecure permissions for the /var/lo ...

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2007-5686, CWE-264.

Evidence: Scanner matched login@1:4.13+dfsg1-1+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-467FD2E456D3 — low — unverified

shadow-utils: Default subordinate ID configuration in /etc/login.defs could lead to compromise

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2024-56433, CWE-1188.

Evidence: Scanner matched login@1:4.13+dfsg1-1+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-9E6A2D18AC62 — low — unverified

[more related to CVE-2005-4890]

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: TEMP-0628843-DBAD28.

Evidence: Scanner matched login@1:4.13+dfsg1-1+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-8EA4554A2216 — low — unverified

util-linux: partial disclosure of arbitrary files in chfn and chsh when compiled with libreadline

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2022-0563, CWE-209.

Evidence: Scanner matched mount@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-4511605DE7EB — low — unverified

util-linux: util-linux: Heap buffer overread in setpwnam() when processing 256-byte usernames

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-14104, CWE-125.

Evidence: Scanner matched mount@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-A5DBE1449075 — low — unverified

gnu-ncurses: ncurses Stack Buffer Overflow

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-6141, CWE-119, CWE-121.

Evidence: Scanner matched ncurses-base@6.4-4 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-BE62469F1E77 — low — unverified

gnu-ncurses: ncurses Stack Buffer Overflow

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-6141, CWE-119, CWE-121.

Evidence: Scanner matched ncurses-bin@6.4-4 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-F4ACAD636EBC — low — unverified

OpenSSL 3.0.0 through 3.3.2 on the PowerPC architecture is vulnerable  ...

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-27587, CWE-385.

Evidence: Scanner matched openssl@3.0.22-1~deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-F54A1C94F8E8 — low — unverified

openssl: openssl: Denial of Service via excessive memory allocation in CRL distribution point processing

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2026-35189, CWE-770.

Evidence: Scanner matched openssl@3.0.22-1~deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-CDFAAF711837 — low — unverified

initscripts in rPath Linux 1 sets insecure permissions for the /var/lo ...

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2007-5686, CWE-264.

Evidence: Scanner matched passwd@1:4.13+dfsg1-1+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-6338850137A8 — low — unverified

shadow-utils: Default subordinate ID configuration in /etc/login.defs could lead to compromise

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2024-56433, CWE-1188.

Evidence: Scanner matched passwd@1:4.13+dfsg1-1+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-D90505887492 — low — unverified

[more related to CVE-2005-4890]

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: TEMP-0628843-DBAD28.

Evidence: Scanner matched passwd@1:4.13+dfsg1-1+deb12u2 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-C41C6B0D88EE — low — unverified

perl: File:: Temp insecure temporary file handling

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2011-4116, CWE-59.

Evidence: Scanner matched perl-base@5.36.0-7+deb12u4 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-407ABD8E90C3 — low — unverified

http-tiny: perl: insecure TLS cert default

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2023-31486, CWE-295.

Evidence: Scanner matched perl-base@5.36.0-7+deb12u4 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-24F953F25671 — low — unverified

[sysvinit: no-root option in expert installer exposes locally exploitable security flaw]

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: TEMP-0517018-A83CE6.

Evidence: Scanner matched sysvinit-utils@3.06-4 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-415AB5DE9ACB — low — unverified

tar: does not properly warn the user when extracting setuid or setgid files

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2005-2541.

Evidence: Scanner matched tar@1.34+dfsg-1.2+deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-BB048D9B50D2 — low — unverified

[tar's rmt command may have undesired side effects]

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: TEMP-0290435-0B57B5.

Evidence: Scanner matched tar@1.34+dfsg-1.2+deb12u1 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-D4E9843C5B64 — low — unverified

util-linux: partial disclosure of arbitrary files in chfn and chsh when compiled with libreadline

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2022-0563, CWE-209.

Evidence: Scanner matched util-linux@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-F4F065448342 — low — unverified

util-linux: util-linux: Heap buffer overread in setpwnam() when processing 256-byte usernames

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-14104, CWE-125.

Evidence: Scanner matched util-linux@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-3A92A18C96CE — low — unverified

util-linux: partial disclosure of arbitrary files in chfn and chsh when compiled with libreadline

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2022-0563, CWE-209.

Evidence: Scanner matched util-linux-extra@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-45E6FA41802A — low — unverified

util-linux: util-linux: Heap buffer overread in setpwnam() when processing 256-byte usernames

Location: `image:open-seo:security-assessment (debian 12.15)`. Agent: D. Confidence: high.

Identifiers: CVE-2025-14104, CWE-125.

Evidence: Scanner matched util-linux-extra@2.38.1-5+deb12u3 against its vulnerability database.

Impact: Scanner identifies an installed Debian package in its advisory database; exploitability through this application is not established.

Remediation: No fixed Debian version is published in the scanner database for this package/advisory. Monitor vendor patches; keep the reduced base image current and validate actual code-path reachability before accepting risk.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests.", "All remaining Debian records have empty FixedVersion after signed apt upgrades; no ignored/unfixed filter was used."]

### INFRA-27F9E589CC84 — low — unverified

golang.org/net/http: Lack of limit when parsing cookies can cause memory exhaustion in net/http

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2025-58186.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-037D2E34D6A3 — low — unverified

os: FileInfo can escape from a Root in golang os module

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-27139, CWE-22.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-8FC56E0613CD — low — unverified

os: golang: golang: Directory traversal via Windows junction handling

Location: `image:app/node_modules/.pnpm/@esbuild+linux-x64@0.25.12/node_modules/@esbuild/linux-x64/bin/esbuild`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56857, CWE-1386.

Evidence: Scanner matched stdlib@v1.23.12 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-F09D004A9EFA — low — unverified

crypto/x509: Panic in name constraint checking for malformed certificates in crypto/x509

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-27138, CWE-295.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-46057D65A3F0 — low — unverified

os: FileInfo can escape from a Root in golang os module

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-27139, CWE-22.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-191C101B796A — low — unverified

os: golang: golang: Directory traversal via Windows junction handling

Location: `image:app/node_modules/.pnpm/@oxlint-tsgolint+linux-x64@0.15.0/node_modules/@oxlint-tsgolint/linux-x64/tsgolint`. Agent: D. Confidence: high.

Identifiers: CVE-2026-56857, CWE-1386.

Evidence: Scanner matched stdlib@v1.26.0 against its vulnerability database.

Impact: Affected Go library metadata is embedded in an esbuild or type-aware-lint executable. These are build/lint tools; public application reachability of the vulnerable Go functions has not been demonstrated.

Remediation: Upgrade to a compatible upstream binary built with patched Go libraries, or validate a reproducible vendor rebuild; do not override compiler/linter versions without build and lint regression checks.

Verification: ["Installed version verified by Trivy; this result alone does not prove runtime exploitability.", "Final built image sha256:8100abcb43f099c4acc66404c1521fb0658b513a3b8493c3145217c31c98f2ff was rescanned after passing cold-start and restart/database-health smoke tests."]

### INFRA-WORKFLOW-TOKEN-PERMISSIONS — low — fixed

Three workflows inherited repository/organization token permissions instead of declaring the read-only permissions they require.

Location: `.github/workflows/{ci,sourcemaps,postgres-tests-playbook}.yml`. Agent: D (implemented by root). Confidence: high.

Identifiers: CWE-250.

Evidence: Checkov3.3.30 reported3 CKV2_GHA_1 failures before the change; all3 files had no top-level permissions declaration. Actual repository/organization default token policy was not inspected.

Impact: Where repository defaults permit writes, compromised build steps could receive unnecessary GitHub token write privileges.

Remediation: Set explicit permissions: contents: read, and request maintainer review of the workflow control-plane change.

Verification: ["Before: security/reports/infrastructure-actions-before.json shows365 passed,3 failed,0 parsing errors.", "After: security/reports/infrastructure-checkov-github-actions.json shows368 passed,0 failed,0 parsing errors.", "Parent reviewed jobs and found no GitHub-token writes required; deployment credentials remain in existing explicit secrets."]

### RUNTIME-b53a0ee967a6 — low — unverified

Application HTML response hardening

Location: `/`. Agent: E. Confidence: medium.

Identifiers: CWE-693.

Evidence: The local development response omits X-Content-Type-Options; correct HTML/JSON MIME types were observed. No executable user-controlled response or MIME-confusion attack was reproduced.

Impact: Defense-in-depth header omission; practical vulnerability and deployed response behavior remain unverified.

Remediation: Confirm staging headers and MIME behavior, then consider nosniff where compatible. Do not infer production configuration from Vite dev responses.

Verification: ["Agent E manually reviewed the healthy isolated hosted-mode development instance on 2026-10-25.", "See security/reports/runtime-assessment.md for scope, evidence and limitations."]

### RUNTIME-c4e28bf8d7a6 — low — unverified

Application HTML response hardening

Location: `/sign-in`. Agent: E. Confidence: medium.

Identifiers: CWE-693.

Evidence: The local development response omits X-Content-Type-Options; correct HTML/JSON MIME types were observed. No executable user-controlled response or MIME-confusion attack was reproduced.

Impact: Defense-in-depth header omission; practical vulnerability and deployed response behavior remain unverified.

Remediation: Confirm staging headers and MIME behavior, then consider nosniff where compatible. Do not infer production configuration from Vite dev responses.

Verification: ["Agent E manually reviewed the healthy isolated hosted-mode development instance on 2026-10-25.", "See security/reports/runtime-assessment.md for scope, evidence and limitations."]

### RUNTIME-da3e43346050 — low — unverified

X-Content-Type-Options Header Missing

Location: `/api/auth/get-session`. Agent: E. Confidence: medium.

Identifiers: CWE-693.

Evidence: The local development response omits X-Content-Type-Options; correct HTML/JSON MIME types were observed. No executable user-controlled response or MIME-confusion attack was reproduced.

Impact: Defense-in-depth header omission; practical vulnerability and deployed response behavior remain unverified.

Remediation: Confirm staging headers and MIME behavior, then consider nosniff where compatible. Do not infer production configuration from Vite dev responses.

Verification: ["Agent E manually reviewed the healthy isolated hosted-mode development instance on 2026-10-25.", "See security/reports/runtime-assessment.md for scope, evidence and limitations."]

### RUNTIME-0356fb367bc9 — low — unverified

X-Content-Type-Options Header Missing

Location: `/api/health`. Agent: E. Confidence: medium.

Identifiers: CWE-693.

Evidence: The local development response omits X-Content-Type-Options; correct HTML/JSON MIME types were observed. No executable user-controlled response or MIME-confusion attack was reproduced.

Impact: Defense-in-depth header omission; practical vulnerability and deployed response behavior remain unverified.

Remediation: Confirm staging headers and MIME behavior, then consider nosniff where compatible. Do not infer production configuration from Vite dev responses.

Verification: ["Agent E manually reviewed the healthy isolated hosted-mode development instance on 2026-10-25.", "See security/reports/runtime-assessment.md for scope, evidence and limitations."]

### RUNTIME-267cc1dc72b1 — low — unverified

X-Content-Type-Options Header Missing

Location: `/.well-known/oauth-authorization-server`. Agent: E. Confidence: medium.

Identifiers: CWE-693.

Evidence: The local development response omits X-Content-Type-Options; correct HTML/JSON MIME types were observed. No executable user-controlled response or MIME-confusion attack was reproduced.

Impact: Defense-in-depth header omission; practical vulnerability and deployed response behavior remain unverified.

Remediation: Confirm staging headers and MIME behavior, then consider nosniff where compatible. Do not infer production configuration from Vite dev responses.

Verification: ["Agent E manually reviewed the healthy isolated hosted-mode development instance on 2026-10-25.", "See security/reports/runtime-assessment.md for scope, evidence and limitations."]

### RUNTIME-127887a0b674 — info — false_positive

Content-Type Header Missing

Location: `/.env`. Agent: E. Confidence: medium.

Identifiers: CWE-345.

Evidence: GET /.env returned Vite HTTP 403 with no file contents. The missing content type belongs to a development-server deny response.

Impact: No secret exposure and no demonstrated product vulnerability.

Remediation: No product change from this development-only response; retain denied access and verify deployed handling separately.

Verification: ["Agent E manually reviewed the healthy isolated hosted-mode development instance on 2026-10-25.", "See security/reports/runtime-assessment.md for scope, evidence and limitations."]

### RUNTIME-9a3d85760c40 — info — false_positive

Modern Web Application

Location: `/.git/config`. Agent: E. Confidence: medium.

Identifiers: none.

Evidence: ZAP identified a modern web application. This informational fingerprint contains no vulnerability assertion.

Impact: No security defect demonstrated.

Remediation: No remediation required.

Verification: ["Agent E manually reviewed the healthy isolated hosted-mode development instance on 2026-10-25.", "See security/reports/runtime-assessment.md for scope, evidence and limitations."]

### RUNTIME-d45364ed0e74 — info — false_positive

Modern Web Application

Location: `/sign-in`. Agent: E. Confidence: medium.

Identifiers: none.

Evidence: ZAP identified a modern web application. This informational fingerprint contains no vulnerability assertion.

Impact: No security defect demonstrated.

Remediation: No remediation required.

Verification: ["Agent E manually reviewed the healthy isolated hosted-mode development instance on 2026-10-25.", "See security/reports/runtime-assessment.md for scope, evidence and limitations."]
