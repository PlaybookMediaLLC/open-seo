# Axiom APM

Relay sends 1% of its traces and request logs to Axiom through Cloudflare's own OpenTelemetry (OTLP) export. The Worker has no telemetry SDK. Cloudflare records the spans and logs, samples them, batches them, and sends them from outside the Worker. An Axiom outage cannot slow or fail a request.

This applies to the Playbook stage only. Other stages keep the upstream settings, because both switches are off by default.

## What existed before

| Signal                    | Where                                   | Notes                                                                                                             |
| ------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Request metrics           | Cloudflare Workers metrics              | Requests, errors, CPU time and duration. Always unsampled.                                                        |
| Request logs and app logs | Cloudflare Workers Logs                 | Every request, 7-day retention. The `observability-triage` skill queries it.                                      |
| Traces                    | Cloudflare Workers traces               | Every request (no sampling), dashboard only.                                                                      |
| Server errors             | PostHog error tracking                  | `captureServerError` sends the error type, code and stack, never the message. Source maps are uploaded on deploy. |
| Growth jobs               | Trigger.dev dashboard                   | Run history, retries and failures.                                                                                |
| Uptime                    | `.github/workflows/uptime-playbook.yml` | Checks `/api/health`, `/` and `/docs` every 15 minutes.                                                           |

Gaps: no traces outside Cloudflare, no Postgres query spans (Cloudflare traces D1, not Hyperdrive), and no alerts on error rate or latency.

## What this adds

1. `OTEL_ENABLED=true` exports traces from both workers (`open-seo-playbook` and `open-seo-playbook-audit`) to the Cloudflare destination `axiom-traces`.
2. `OTEL_LOGS_ENABLED=true` exports request logs to the destination `axiom-logs`.
3. `OTEL_SAMPLING_RATE` (default `0.01`) samples both.
4. Each Postgres query runs in a `pg_query` span (`src/db/pg/querySpan.ts`). A transaction gets one span for all its statements, with the operation `BEGIN`.
5. The Google CrUX and Map Tiles calls send their API key in the `X-Goog-Api-Key` header, so that no trace records a key.

The code is in `deploy/alchemy/relay-env.ts` (`relayObservability`).

## Sampling policy

| Signal                            | Policy        | How                                                                                                                                                 |
| --------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal traces                     | 1%            | Cloudflare head sampling, one decision for each request.                                                                                            |
| Request logs                      | 1%            | The same head sampling, on the logs channel.                                                                                                        |
| Errors and HTTP 5xx               | 1% in Axiom   | Head sampling decides before the request fails. PostHog error tracking receives every server error.                                                 |
| Slow requests                     | 1%            | The same as all requests. Exact latency is in Cloudflare's Workers metrics.                                                                         |
| Health checks                     | Not excluded  | Head sampling cannot filter by route. The uptime check makes 96 requests a day, which is about 1 sample a day. Filter `/api/health` out of queries. |
| Background work (Workflows, cron) | 1%            | The same rate as requests.                                                                                                                          |
| Aggregated metrics                | Unsampled     | Cloudflare's Workers metrics. Axiom has only the 1% sample.                                                                                         |
| Error events                      | Kept, grouped | PostHog error tracking groups errors by fingerprint.                                                                                                |

The logs rate also applies to the logs that Cloudflare keeps. With `OTEL_LOGS_ENABLED=true`, the Workers Logs dashboard and the `observability-triage` queries show 1% of requests. Multiply their counts by 100, or use the Workers metrics for exact counts. Cloudflare does not document whether the traces and the logs sample the same requests.

Cloudflare shows service binding and Durable Object calls as child spans of the caller's trace (Cloudflare changelog, 7 May 2026). Make sure of this in the first traces: a site audit trace must include spans from the audit worker.

### Why there is no tail sampling

Tail sampling needs an OpenTelemetry Collector that receives 100% of the traces and keeps the failed ones. Relay has no server to run it on. The Collector would also make Cloudflare export every trace. PostHog already records every server error. Add a Collector only if you need the full span tree of every failed request.

## Privacy

Axiom is a provider that receives data. The privacy policy names it (`src/client/features/legal/privacy.ts`, and the `web/content/legal/privacy.md` copy), in the provider list and in the Google user data section. Update both if what Axiom receives changes.

What each switch sends:

- Traces: request paths and query strings, outbound URLs, status codes, timings, country, user agent, and parameterized SQL. Not request bodies, cookies or `Authorization` headers. A Search Console API URL contains the property address, and an Analytics API URL contains the property ID.
- Logs: the request data above, plus every `console` line of the sampled requests. Error messages can quote customer content. This is why `withoutMessage` in `src/server/lib/posthog.ts` keeps them out of PostHog. Turn logs on only if you accept this.

Sign-in tokens stay out of request URLs. Password reset and verification emails link to our page with the token in the URL fragment (`/reset-password#token=…`, `/verify-email#token=…`), which browsers never send (`src/server/auth/emailLinks.ts`). The reset page posts the token to Better Auth in a request body. The verify page posts it to `/api/verify-email-link`, which calls Better Auth in-process. A verification link only confirms the email and then opens sign-in. It does not sign in, so a page that sends a visitor to someone else's link cannot sign the visitor into that account (login CSRF). Links sent before this change still use `?token=` until they expire (1 hour).

These URLs still reach traces, by design:

- Shared report links (`/r/<id>`) and report map grants (`/report-map/<grant>/…`). A person who reads them can see that report. Limit read access to the Axiom datasets.
- OAuth callbacks (`?code=`). A code is single-use and needs the client secret.
- Invitation links (`/accept-invitation/<id>`). Only the invited email can accept them.

## Set up

1. In Axiom, create two datasets: `relay-traces-production` and `relay-logs-production` (kind Events, 30-day retention). Both exist in the Solomon AI organization.
2. In Axiom, create an API token (`relay-otel-production-ingest`) that can only ingest into these two datasets. Give read access to the datasets only to the people who operate Relay. Keep the retention short (30 days or less).
3. In the Cloudflare dashboard of the Playbook account, go to **Observability** > **Destinations**. Add two destinations:

   | Name           | Type   | OTLP endpoint                    | Headers                                                                     |
   | -------------- | ------ | -------------------------------- | --------------------------------------------------------------------------- |
   | `axiom-traces` | Traces | `https://api.axiom.co/v1/traces` | `Authorization: Bearer <token>`, `X-Axiom-Dataset: relay-traces-production` |
   | `axiom-logs`   | Logs   | `https://api.axiom.co/v1/logs`   | `Authorization: Bearer <token>`, `X-Axiom-Dataset: relay-logs-production`   |

   The names are case-sensitive. The token stays in Cloudflare. Do not put it in `ENV_PLAYBOOK` or in the repository.

4. In the `ENV_PLAYBOOK` repository secret, set `OTEL_ENABLED=true`. Set `OTEL_LOGS_ENABLED=true` only if you accept what logs send (see [Privacy](#privacy)).
5. Run the **Deploy (Playbook Media)** workflow.
6. Make sure that it works:
   1. In **Observability** > **Destinations**, each destination shows "Last: n minutes ago", not "Error" or "Never run".
   2. In Axiom, run `['relay-traces-production'] | take 10`. Data can take several minutes to arrive. At 1%, a quiet hour can have no traces. To test, set `OTEL_SAMPLING_RATE=1`, deploy, check, then set it back.
   3. Open one trace. Find `service.name`, `cloudflare.ray_id` and `cloudflare.script_version.id`.
   4. Start a site audit. Find one trace that has spans from both workers.
   5. Find a `pg_query` span. It has `db.operation.name` and `db.query.text`.

## Configuration

| Variable             | Default     | Effect                                                                                           |
| -------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| `OTEL_ENABLED`       | empty (off) | `true` exports traces to `axiom-traces`.                                                         |
| `OTEL_LOGS_ENABLED`  | empty (off) | `true` exports request logs to `axiom-logs`.                                                     |
| `OTEL_SAMPLING_RATE` | `0.01`      | The share of requests that Cloudflare traces and logs, 0 to 1. Used only by a switch that is on. |

A value that is not valid stops the deploy with the name of the variable.

Cloudflare controls the batch size, the export interval, the queue, the timeouts and the retries. Relay cannot change them. The service name is the worker name, which includes the stage. The deployment version is `cloudflare.script_version.id`.

## What a trace contains

- Root span: `service.name`, `faas.trigger`, `cloudflare.ray_id`, `cloudflare.outcome` (`ok`, `exception`, `exceededCpu`, `exceededMemory`), `cloudflare.cpu_time_ms`, `cloudflare.wall_time_ms`, `url.path`, `http.response.status_code`.
- Cloudflare spans: outbound `fetch`, D1, KV, R2, Durable Objects, service binding RPC, Browser Rendering, rate limits, cron and email handlers.
- `pg_query`: `db.system.name`, `db.operation.name` (`BEGIN` for a transaction), `db.query.text` (first 1,000 characters), `relay.retry_count` when a query was retried, and `error.type` (the Postgres or connection error code) when it failed. The error message is never recorded.

The first query of a new isolate has no span. It starts the load of the tracing API. The statements inside a transaction have no span of their own: their time and error are on the `BEGIN` span.

## Alerts

Put alerts on unsampled data. A 1% sample is too small and too uneven to alert on.

1. Cloudflare: in **Notifications**, add the Workers alerts that the account offers for error rate and duration of `open-seo-playbook` and `open-seo-playbook-audit`. If no alert type fits, check the Workers metrics each week.
2. PostHog error tracking: an alert on a new issue, and an alert on a spike of an issue.
3. Trigger.dev: an alert on a failed run of a growth job.
4. Uptime: the existing workflow emails the repository owner when Relay does not answer.

Use Axiom to investigate, not to alert. These queries find patterns in the sample. Cloudflare's documentation does not list the field names of the exported logs. After the first logs arrive, open one request log and put its field names in place of the `<…>` names.

| Question                | Query (APL)                                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which routes fail?      | `['relay-logs-production'] \| where <outcome> != "ok" or <status> >= 500 \| summarize count() by <route>`                                             |
| Which routes are slow?  | `['relay-logs-production'] \| where <route> != "/api/health" \| summarize percentile(<wall time>, 95) by <route>`                                     |
| Which queries are slow? | `['relay-traces-production'] \| where name == "pg_query" \| summarize percentile(duration, 95), count() by ['attributes.db.query.text']`              |
| Which queries fail?     | `['relay-traces-production'] \| where name == "pg_query" and isnotempty(['attributes.error.type']) \| summarize count() by ['attributes.error.type']` |

Each count is about 1% of the real number. Confirm the trace field paths on the first traces too: Axiom can put an attribute that it does not know under `attributes.custom`.

To find the cause of a failure, start from the PostHog error. Search Axiom by its time and route. The request has a trace only if Cloudflare sampled it.

## Cost estimate

Assumptions: a sampled request makes about 10 spans of 0.5 KB (5 KB a trace). A request log with one `console` line is about 1.5 KB. Measure the real sizes in the Axiom usage page after one week.

| Requests a day | Traces at 1% (a month) | Logs at 1% (a month) |
| -------------- | ---------------------- | -------------------- |
| 100,000        | 0.15 GB                | 0.05 GB              |
| 1,000,000      | 1.5 GB                 | 0.45 GB              |
| 10,000,000     | 15 GB                  | 4.5 GB               |

Axiom's free Personal plan includes 500 GB of ingest a month. The Cloud plan costs $25 a month, includes 1,000 GB, and then costs $0.12 for each GB. Make sure of these prices on axiom.co/pricing before you rely on them. At these rates, Relay stays in the free plan up to far more traffic than it has today.

On the Cloudflare side, traces drop from 100% to 1%, and so do logs when `OTEL_LOGS_ENABLED=true`. This lowers the storage that Cloudflare bills from 1 December 2026. Cloudflare still keeps its own copy of the sample (`persist` stays at its default). When the team triages in Axiom instead of the Cloudflare dashboard, set `persist: false` to stop paying twice. The `observability-triage` skill reads the Cloudflare copy, so update it at the same time.

## Troubleshooting

| Symptom                                              | Cause and fix                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The deploy stops with an `OTEL_SAMPLING_RATE` error. | The value is not a number from 0 to 1. Fix it in `ENV_PLAYBOOK`.                                                                                                   |
| The deploy fails on an unknown destination.          | Create `axiom-traces` and `axiom-logs` first, with the exact names.                                                                                                |
| The destination shows "Error".                       | Check the token, its dataset permission, and the `X-Axiom-Dataset` header.                                                                                         |
| The destination shows "Never run".                   | The worker does not use it. Check that the deploy ran with the switch set. In the dashboard, the worker's **Settings** > **Observability** lists its destinations. |
| Cloudflare log counts dropped.                       | `OTEL_LOGS_ENABLED=true` samples Cloudflare's logs at 1% too. Use the Workers metrics for exact counts.                                                            |
| No `pg_query` spans.                                 | The stage runs on D1, which Cloudflare traces itself. Or the standalone runtime runs the app, which has no tracing API.                                            |
| The Axiom bill grows.                                | Lower `OTEL_SAMPLING_RATE`, or turn `OTEL_LOGS_ENABLED` off.                                                                                                       |
| A key or token appears in a URL in Axiom.            | Move it to a header in the code, as in `src/server/lib/crux.ts`. Then delete the data in Axiom and rotate the key.                                                 |

To stop the export, empty `OTEL_ENABLED` and `OTEL_LOGS_ENABLED` in `ENV_PLAYBOOK` and deploy.
