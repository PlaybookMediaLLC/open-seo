DROP INDEX `opportunity_ga4_evidence_opportunity_run_period_idx`;--> statement-breakpoint
ALTER TABLE `opportunity_ga4_evidence` ADD `device` text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunity_ga4_evidence` ADD `engaged_sessions` real;--> statement-breakpoint
ALTER TABLE `opportunity_ga4_evidence` ADD `key_event_name` text;--> statement-breakpoint
ALTER TABLE `opportunity_ga4_evidence` ADD `form_starts` real;--> statement-breakpoint
ALTER TABLE `opportunity_ga4_evidence` ADD `form_submits` real;--> statement-breakpoint
CREATE UNIQUE INDEX `opportunity_ga4_evidence_opportunity_run_period_idx` ON `opportunity_ga4_evidence` (`opportunity_id`,`run_id`,`period`,`device`);--> statement-breakpoint
ALTER TABLE `project_conversion_events` ADD `channel` text DEFAULT 'organic_search' NOT NULL;