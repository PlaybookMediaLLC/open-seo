CREATE TABLE `opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`site_url` text NOT NULL,
	`identity_key` text NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`query` text,
	`title` text NOT NULL,
	`explanation` text NOT NULL,
	`recommended_action` text NOT NULL,
	`search_intent` text NOT NULL,
	`confidence` real NOT NULL,
	`effort_hours` real NOT NULL,
	`priority` integer NOT NULL,
	`commercial_score` real NOT NULL,
	`demand_score` real NOT NULL,
	`visibility_score` real NOT NULL,
	`difficulty_score` real NOT NULL,
	`effort_score` real NOT NULL,
	`score_explanation` text NOT NULL,
	`uncertainty` text NOT NULL,
	`status` text DEFAULT 'discovered' NOT NULL,
	`owner_user_id` text,
	`evidence_run_id` text NOT NULL,
	`first_detected_at` text NOT NULL,
	`last_detected_at` text NOT NULL,
	`deferred_until` text,
	`version` integer DEFAULT 1 NOT NULL,
	`last_decision_id` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evidence_run_id`) REFERENCES `opportunity_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opportunities_project_identity_idx` ON `opportunities` (`project_id`,`identity_key`);--> statement-breakpoint
CREATE INDEX `opportunities_project_status_priority_idx` ON `opportunities` (`project_id`,`status`,`priority`);--> statement-breakpoint
CREATE TABLE `opportunity_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`evidence_run_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`decision` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evidence_run_id`) REFERENCES `opportunity_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `opportunity_decisions_project_opportunity_idx` ON `opportunity_decisions` (`project_id`,`opportunity_id`);--> statement-breakpoint
CREATE TABLE `opportunity_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`run_id` text NOT NULL,
	`source` text NOT NULL,
	`period` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`clicks` real NOT NULL,
	`impressions` real NOT NULL,
	`ctr` real NOT NULL,
	`position` real NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `opportunity_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opportunity_evidence_opportunity_run_period_idx` ON `opportunity_evidence` (`opportunity_id`,`run_id`,`period`);--> statement-breakpoint
CREATE INDEX `opportunity_evidence_project_opportunity_idx` ON `opportunity_evidence` (`project_id`,`opportunity_id`);--> statement-breakpoint
CREATE TABLE `opportunity_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`site_url` text NOT NULL,
	`status` text NOT NULL,
	`requested_by` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`previous_start_date` text NOT NULL,
	`previous_end_date` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`query_rows` integer DEFAULT 0 NOT NULL,
	`current_page_rows` integer DEFAULT 0 NOT NULL,
	`previous_page_rows` integer DEFAULT 0 NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`opportunity_count` integer DEFAULT 0 NOT NULL,
	`truncated` integer DEFAULT false NOT NULL,
	`error` text,
	`completion_token` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `opportunity_runs_project_started_idx` ON `opportunity_runs` (`project_id`,`started_at`);