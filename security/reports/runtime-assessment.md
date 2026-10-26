# Runtime assessment — 2026-10-25

Agent E installed Nuclei **3.11.1** and OWASP ZAP **2.17.0** from their official
GitHub releases and verified both archives against the published SHA-256 values.
The checks ran against an isolated local copy of the repository with its own D1
state, dummy hosted-auth/Google/email/captcha configuration, disabled telemetry,
and no real provider credentials. Production and external staging were not scanned.

The healthy application was reached at `http://127.0.0.1:3217`. Nuclei executed two
reviewed HTTP templates, covering three GET requests at one request per second.
ZAP executed eight explicit GET requests in an exact-path protected context with
all active scanner rules disabled, then drained its passive scanner queue. Neither
tool followed redirects, crawled links, performed OAST callbacks, signed in, sent
mutation requests, or invoked paid integrations. No response bodies, cookies,
authorization headers, or raw secret-bearing payloads are included in reports.

```sh
SECURITY_TOOLS_DIR=/workspace/.security-tools \
SECURITY_DAST_TARGET=http://127.0.0.1:3217 \
SECURITY_DAST_AUTHORIZED=yes \
bash security/scanners/runtime.sh security/reports dast
python3 -m unittest discover -s security/scanners -p runtime_test.py
```

The wrapper exits 2 because Burp is unavailable; this is not a successful complete
three-tool DAST gate. Nuclei and ZAP individually completed successfully.

## Findings and validation

| Detection | Validation | Disposition |
| --- | --- | --- |
| Nuclei response-headers; ZAP 10021 | The tested HTML/JSON responses omit `X-Content-Type-Options`. No user-controlled executable response or MIME-confusion exploit was demonstrated. | Low hardening observation, unverified vulnerability; validate the deployed response before choosing a fix. Duplicate tool observations merge by endpoint. |
| ZAP 10055 CSP subrules | HTML responses use `frame-ancestors 'self'`. `src/server.ts` deliberately scopes this policy to framing; its comment explains that script CSP requires nonce/bootstrap/Turnstile/PostHog work. No injection or XSS chain was reproduced. | Medium defense-in-depth observation, unverified vulnerability. Plan a nonce-compatible policy with staging/browser verification; do not claim an XSS defect from this alert alone. CSP subrules merge by endpoint. |
| ZAP 10109 Modern Web Application | Informational detection of the framework/application shape. | False positive as a vulnerability; no remediation required. |
| ZAP 10019 at `/.env` | Vite rejects the request with HTTP 403. This development-server error response lacks a content type; no file contents were returned. | False positive as a product vulnerability; do not infer deployed response behavior from the development server. |

The endpoint response metadata in `runtime-zap.json` confirms `/api/health` and
`/api/auth/get-session` returned 200, unauthenticated `/mcp` returned 401,
`/.git/config` returned 404, and `/.env` returned 403. The Git exposure template
produced no finding. Header hardening observations remain visible and are not
suppressed in future runs. No application vulnerability was confirmed by this
bounded unauthenticated assessment, so no application code is marked remediated.

Four runtime safety tests pass, covering explicit target authorization, exact
staging-origin matching, invalid/credential-bearing targets, path escape attempts,
and an actual loopback redirect proving that readiness checks never follow it.
The scanner refuses unavailable, redirected, or unhealthy readiness endpoints;
ZAP also rejects invalid/server-error responses as incomplete coverage. This
prevents a zero-result Nuclei exit from being mistaken for an unreachable target
having passed a scan.

## Remaining coverage and manual work

Burp Suite could not be downloaded: the environment's proxy rejected the official
PortSwigger release host with CONNECT HTTP 403. No installed binary or license was
available. Community Edition supports manual proxy/repeater review, not automated
vulnerability scanning; see `security/configs/burp.md`. No Burp scan is claimed.

The target uses Vite development serving, not the deployed Worker/CDN or final
Docker image. Authenticated multi-tenant authorization, browser behavior,
production response policies, external OAuth, signed webhooks, and paid provider
calls were not dynamically exercised. Repeat the configured passive scan against
an explicitly authorized staging origin and conduct scoped authenticated review
with disposable accounts. The registry's remaining header observations are not
accepted risks on behalf of the maintainer; they remain unverified pending that
assessment.
