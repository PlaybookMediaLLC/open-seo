# Burp Suite manual verification

Download a current Community or licensed Professional release only from
https://portswigger.net/burp/releases. The assessment environment cannot reach
portswigger.net: its outbound proxy returns CONNECT HTTP 403. No Burp binary,
license, or GUI was available; no Burp scan result is claimed.

Community Edition has an HTTP proxy/repeater but no automated vulnerability
scanner. Use the same explicitly authorized exact staging origin as the other
runtime tools, with no third-party origins. Configure Target scope to that origin,
disable out-of-scope logging and automatic redirects, and manually send only the
GET paths in `runtime-paths.json`. Do not sign into production, invoke paid
integrations, run Intruder, or enable active scanning. Save only redacted issue
metadata in the findings registry; do not commit request/response bodies,
cookies, authorization headers, or a Burp project file.

A licensed Professional or DAST installation may be integrated separately only
after operator configuration and target authorization. Set `BURP_JAR` to an
already-installed official jar for the runtime wrapper to verify its CLI version;
this does not enable or claim automated Burp coverage.
