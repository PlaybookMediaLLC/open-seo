# Secrets assessment — 2026-10-25

Gitleaks **8.30.1** and TruffleHog **3.99.7** were installed from the current stable official GitHub releases. Both release archives matched the publishers' SHA-256 checksum files. The reusable installer was executed successfully, including executable version checks.

## Executed coverage

| Tool | Current tracked and nonignored files | All available Git refs (1,173 commits) |
| --- | ---: | ---: |
| Gitleaks | 8 detections | 8 detections |
| TruffleHog | 7 detections | 8 detections |

The **31 occurrences normalize to 15 reviewed false-positive findings**. Every occurrence is tied to a source-file SHA-256 digest, path, rule, and line in `security/configs/secrets-triage.json`. A source change invalidates that review and produces an unverified finding. No scanner rule, file class, test directory, or finding was suppressed.

The detected values are synthetic Stripe test patterns, an explicitly named publishing encryption fixture, public PostHog ingestion identifiers, a public OpenAI ownership challenge, and placeholder credential-bearing URLs in validation tests and migration documentation. The Stripe fixtures were checked for ordered hexadecimal/alphabet patterns and mocked provider usage. URI findings were parsed privately and checked against their test/documentation context.

**No compromised credential was confirmed. No revocation or rotation action is identified by this assessment.** No production keys were tested against a provider. No Git history was changed.

## Reproduction

```sh
SECURITY_TOOLS_DIR=/workspace/.security-tools bash security/install/secrets.sh
SECURITY_TOOLS_DIR=/workspace/.security-tools bash security/scanners/secrets.sh security/reports full
python3 security/scanners/secrets-test.py
```

Use a different `SECURITY_TOOLS_DIR` or omit it outside this assessment workspace. The default is `$HOME/.local/share/open-seo-security`.

The runner executed all four scans successfully and returned exit code 0 after review. Findings are still present in the metadata reports; exit code 0 does not mean the raw scanners found zero candidates. The raw Gitleaks finding exit is 10 and TruffleHog finding exit is 183; the wrapper distinguishes those from execution failures and performs explicit triage.

Three regression tests passed: secret-bearing raw fields and stderr are never published; changing exact reviewed source requires new review; cross-scanner grouping preserves every detection rule and scanner. The provenance regression failed against the original implementation and passed after the fix. A separate missing-executable check returned exit 2 with blocked tools and deferred fast-mode history, confirming missing tooling cannot report success. Shell syntax checks passed.

## Coverage limits and report handling

- Current-file scanning copies only Git-tracked and nonignored files into a private temporary snapshot. Local ignored environment files, dependency install directories, symlinks, and generated scanner reports are not copied or read by these scans.
- Full mode scans all locally available Git references, including history, without fetching remote references. Unreachable objects and unfetched remote branches are outside this coverage. A shallow full-mode checkout is explicitly blocked.
- TruffleHog uses `--no-verification --no-update --no-ignore-tag`; Gitleaks uses its complete built-in rule set and ignores inline allow comments. Built-in detector heuristics still apply.
- Published JSON is a metadata-only projection of scanner output, not raw native JSON. Secret values, source snippets, author emails, commit messages, and provider response data are omitted. Private raw scan output is deleted after normalization.
- Fast mode intentionally defers history while scanning current source with both tools. It does not describe deferred history as scanned or inapplicable.
