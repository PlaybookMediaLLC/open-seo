ALTER TABLE "split_test_analyses" ADD COLUMN "sessions_estimate_pct" double precision;--> statement-breakpoint
ALTER TABLE "split_test_analyses" ADD COLUMN "sessions_ci_low_pct" double precision;--> statement-breakpoint
ALTER TABLE "split_test_analyses" ADD COLUMN "sessions_ci_high_pct" double precision;--> statement-breakpoint
ALTER TABLE "split_test_analyses" ADD COLUMN "key_events_estimate_pct" double precision;--> statement-breakpoint
ALTER TABLE "split_test_analyses" ADD COLUMN "key_events_ci_low_pct" double precision;--> statement-breakpoint
ALTER TABLE "split_test_analyses" ADD COLUMN "key_events_ci_high_pct" double precision;