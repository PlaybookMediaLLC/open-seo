ALTER TABLE `split_test_analyses` ADD `sessions_estimate_pct` real;--> statement-breakpoint
ALTER TABLE `split_test_analyses` ADD `sessions_ci_low_pct` real;--> statement-breakpoint
ALTER TABLE `split_test_analyses` ADD `sessions_ci_high_pct` real;--> statement-breakpoint
ALTER TABLE `split_test_analyses` ADD `key_events_estimate_pct` real;--> statement-breakpoint
ALTER TABLE `split_test_analyses` ADD `key_events_ci_low_pct` real;--> statement-breakpoint
ALTER TABLE `split_test_analyses` ADD `key_events_ci_high_pct` real;