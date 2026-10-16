CREATE TABLE `opportunity_ga4_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`run_id` text NOT NULL,
	`period` text NOT NULL,
	`landing_page` text NOT NULL,
	`sessions` real NOT NULL,
	`key_events` real NOT NULL,
	`revenue` real,
	`currency` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `opportunity_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opportunity_ga4_evidence_opportunity_run_period_idx` ON `opportunity_ga4_evidence` (`opportunity_id`,`run_id`,`period`);--> statement-breakpoint
CREATE INDEX `opportunity_ga4_evidence_project_opportunity_idx` ON `opportunity_ga4_evidence` (`project_id`,`opportunity_id`);--> statement-breakpoint
CREATE TABLE `opportunity_urls` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`url` text NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opportunity_urls_opportunity_url_role_idx` ON `opportunity_urls` (`opportunity_id`,`url`,`role`);--> statement-breakpoint
CREATE INDEX `opportunity_urls_project_opportunity_idx` ON `opportunity_urls` (`project_id`,`opportunity_id`);--> statement-breakpoint
CREATE TABLE `project_brand_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`term` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_brand_terms_project_term_idx` ON `project_brand_terms` (`project_id`,`term`);--> statement-breakpoint
DROP INDEX `opportunity_evidence_opportunity_run_period_idx`;--> statement-breakpoint
ALTER TABLE `opportunity_evidence` ADD `url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunity_evidence` ADD `query` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `opportunity_evidence_run_period_url_query_idx` ON `opportunity_evidence` (`opportunity_id`,`run_id`,`period`,`url`,`query`);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `diagnosis` text;--> statement-breakpoint
ALTER TABLE `opportunity_runs` ADD `kind` text DEFAULT 'search_console' NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunity_runs` ADD `year_ago_page_rows` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunity_runs` ADD `ga4_property_id` text;