-- RFC-0008 sections 10 to 12: read-only acceptance numbers for scheduled jobs.
-- Run against the production Postgres database with a read-only role:
--   psql "$RELAY_READONLY_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/rfc0008-acceptance.sql
-- The period starts at the first Worker cron run, 2026-10-18 11:00 UTC.
\set since '''2026-10-18T11:00:00.000Z'''

-- 1. Every due window ends once: outcome per window, kind and project.
WITH windows AS (
  SELECT r.project_id, r.kind, r.window_key,
         bool_or(r.status = 'succeeded') AS succeeded,
         bool_or(r.status = 'skipped') AS skipped,
         count(*) FILTER (WHERE r.status = 'succeeded') AS succeeded_rows,
         max(r.attempt) AS attempts
  FROM growth_job_runs r
  WHERE r.created_at >= :since AND r.status <> 'queued'
  GROUP BY 1, 2, 3
)
SELECT count(*) AS windows,
       round(100.0 * count(*) FILTER (WHERE succeeded OR skipped) / nullif(count(*), 0), 2) AS pct_succeeded_or_skipped,
       count(*) FILTER (WHERE succeeded_rows > 1) AS duplicate_windows,
       count(*) FILTER (WHERE attempts > 1) AS retried_windows
FROM windows;

-- 2. No two runs of one kind overlap for one project.
SELECT count(*) AS overlapping_pairs
FROM growth_job_runs a
JOIN growth_job_runs b
  ON a.project_id = b.project_id AND a.kind = b.kind AND a.id < b.id
 AND a.started_at < coalesce(b.finished_at, '9999')
 AND b.started_at < coalesce(a.finished_at, '9999')
WHERE a.created_at >= :since AND b.created_at >= :since;

-- 3. Each first attempt starts within 20 minutes of its hour; latest first.
-- Runs before the 2026-10-27 deploy store their cron tick as the start, and a
-- schedule whose hour changed since shows here too. The weekly cycle keeps a
-- local hour, so it is left out.
SELECT r.kind, r.window_key, s.hour_utc, r.started_at,
       round(extract(epoch FROM (r.started_at::timestamptz
         - (r.window_key || 'T' || lpad(s.hour_utc::text, 2, '0') || ':00:00Z')::timestamptz)) / 60) AS minutes_late
FROM growth_job_runs r
JOIN growth_schedules s ON s.id = r.schedule_id
WHERE r.created_at >= :since AND r.attempt = 1 AND r.kind <> 'weekly_cycle'
ORDER BY minutes_late DESC
LIMIT 20;

-- 4. Skips and final failures with their reasons (removed owner, plan).
SELECT status, coalesce(skip_reason, error) AS reason, count(*)
FROM growth_job_runs
WHERE created_at >= :since AND status IN ('skipped', 'failed')
GROUP BY 1, 2 ORDER BY 3 DESC;

-- 5. Notification kinds seen; notices equal distinct keys when none repeats.
SELECT kind, count(*) AS notices, count(DISTINCT (project_id, dedupe_key)) AS distinct_keys
FROM growth_notifications
WHERE created_at >= :since
GROUP BY 1 ORDER BY 1;

-- 6. Live projects that never got their default jobs (section 12). A job a
-- member turned off has a row, so it is not listed.
SELECT p.id AS project_id, p.name,
       EXISTS (SELECT 1 FROM gsc_connections g WHERE g.project_id = p.id) AS search_console,
       EXISTS (SELECT 1 FROM growth_experiments e WHERE e.project_id = p.id) AS tracking
FROM projects p
WHERE p.archived_at IS NULL
  AND ((EXISTS (SELECT 1 FROM gsc_connections g WHERE g.project_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM growth_schedules s
                        WHERE s.project_id = p.id AND s.kind = 'opportunity_refresh'))
    OR (EXISTS (SELECT 1 FROM growth_experiments e WHERE e.project_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM growth_schedules s
                        WHERE s.project_id = p.id AND s.kind = 'measurement_refresh')))
ORDER BY p.name;
