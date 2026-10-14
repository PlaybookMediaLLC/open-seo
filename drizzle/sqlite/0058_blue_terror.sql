CREATE TABLE `growth_experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`proposal_id` text NOT NULL,
	`execution_id` text NOT NULL,
	`site_url` text NOT NULL,
	`target_url` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`pull_request_state` text NOT NULL,
	`pull_request_checked_at` text,
	`merged_at` text,
	`merge_commit_sha` text,
	`deployed_at` text,
	`deployment_confirmed_by` text,
	`deployment_note` text,
	`deployment_confirmed_at` text,
	`other_changes` integer NOT NULL,
	`seasonal_risk` integer NOT NULL,
	`baseline_start` text,
	`baseline_end` text,
	`observation_start` text,
	`observation_end` text,
	`baseline_run_id` text,
	`last_event_id` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proposal_id`) REFERENCES `opportunity_proposals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`execution_id`) REFERENCES `proposal_executions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`baseline_run_id`) REFERENCES `measurement_runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `growth_experiments_execution_idx` ON `growth_experiments` (`execution_id`);--> statement-breakpoint
CREATE INDEX `growth_experiments_project_created_idx` ON `growth_experiments` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `measurement_days` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`experiment_id` text NOT NULL,
	`run_id` text NOT NULL,
	`period` text NOT NULL,
	`date` text NOT NULL,
	`clicks` real NOT NULL,
	`impressions` real NOT NULL,
	`ctr` real NOT NULL,
	`position` real NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`experiment_id`) REFERENCES `growth_experiments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `measurement_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `measurement_days_run_period_date_idx` ON `measurement_days` (`run_id`,`period`,`date`);--> statement-breakpoint
CREATE INDEX `measurement_days_project_experiment_idx` ON `measurement_days` (`project_id`,`experiment_id`);--> statement-breakpoint
CREATE TABLE `measurement_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`experiment_id` text NOT NULL,
	`status` text NOT NULL,
	`requested_by` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`request_count` integer NOT NULL,
	`includes_baseline` integer NOT NULL,
	`observation_through` text,
	`outcome` text NOT NULL,
	`explanation` text NOT NULL,
	`overlapping_changes` integer NOT NULL,
	`window_complete` integer NOT NULL,
	`error` text,
	`claim_token` text NOT NULL,
	`completion_token` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`experiment_id`) REFERENCES `growth_experiments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `measurement_runs_project_started_idx` ON `measurement_runs` (`project_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `measurement_runs_experiment_started_idx` ON `measurement_runs` (`project_id`,`experiment_id`,`started_at`);