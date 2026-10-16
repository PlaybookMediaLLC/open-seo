CREATE TABLE `competitor_keyword_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`keyword` text NOT NULL,
	`position` integer NOT NULL,
	`url` text,
	`search_volume` integer NOT NULL,
	`keyword_difficulty` integer,
	`intent` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`snapshot_id`) REFERENCES `competitor_keyword_snapshots`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `competitor_keyword_rows_snapshot_idx` ON `competitor_keyword_rows` (`snapshot_id`);--> statement-breakpoint
CREATE TABLE `competitor_keyword_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`domain` text NOT NULL,
	`location_code` integer NOT NULL,
	`language_code` text NOT NULL,
	`fetched_at` text NOT NULL,
	`row_count` integer NOT NULL,
	`estimated_credits` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competitor_keyword_snapshots_project_domain_market_idx` ON `competitor_keyword_snapshots` (`project_id`,`domain`,`location_code`,`language_code`,`fetched_at`);--> statement-breakpoint
CREATE TABLE `opportunity_ai_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`run_id` text NOT NULL,
	`tracker_id` text NOT NULL,
	`citations` integer NOT NULL,
	`answers` integer NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `opportunity_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opportunity_ai_evidence_opportunity_run_tracker_idx` ON `opportunity_ai_evidence` (`opportunity_id`,`run_id`,`tracker_id`);--> statement-breakpoint
CREATE INDEX `opportunity_ai_evidence_project_opportunity_idx` ON `opportunity_ai_evidence` (`project_id`,`opportunity_id`);--> statement-breakpoint
CREATE TABLE `opportunity_keyword_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`run_id` text NOT NULL,
	`keyword` text NOT NULL,
	`location_code` integer NOT NULL,
	`language_code` text NOT NULL,
	`search_volume` integer NOT NULL,
	`keyword_difficulty` integer,
	`intent` text,
	`competitor_domain` text NOT NULL,
	`competitor_url` text,
	`competitor_position` integer NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `opportunity_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opportunity_keyword_evidence_run_keyword_competitor_idx` ON `opportunity_keyword_evidence` (`opportunity_id`,`run_id`,`keyword`,`competitor_domain`);--> statement-breakpoint
CREATE INDEX `opportunity_keyword_evidence_project_opportunity_idx` ON `opportunity_keyword_evidence` (`project_id`,`opportunity_id`);--> statement-breakpoint
CREATE TABLE `opportunity_serp_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`keyword` text NOT NULL,
	`page_position` integer,
	`has_ads` integer NOT NULL,
	`has_ai_overview` integer NOT NULL,
	`has_featured_snippet` integer NOT NULL,
	`confidence_delta` real NOT NULL,
	`estimated_credits` integer NOT NULL,
	`checked_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `opportunity_serp_checks_project_opportunity_idx` ON `opportunity_serp_checks` (`project_id`,`opportunity_id`,`checked_at`);