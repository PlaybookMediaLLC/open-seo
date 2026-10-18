CREATE TABLE `split_test_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`test_id` text NOT NULL,
	`project_id` text NOT NULL,
	`run_at` text NOT NULL,
	`observation_days` integer NOT NULL,
	`estimate_pct` real,
	`ci_low_pct` real,
	`ci_high_pct` real,
	`p_value` real,
	`pre_period_p_value` real,
	`label` text NOT NULL,
	`notes` text,
	FOREIGN KEY (`test_id`) REFERENCES `split_tests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `split_test_analyses_test_idx` ON `split_test_analyses` (`test_id`,`run_at`);--> statement-breakpoint
CREATE TABLE `split_test_days` (
	`id` text PRIMARY KEY NOT NULL,
	`test_id` text NOT NULL,
	`project_id` text NOT NULL,
	`path` text NOT NULL,
	`date` text NOT NULL,
	`clicks` integer NOT NULL,
	`impressions` integer NOT NULL,
	`position` real,
	FOREIGN KEY (`test_id`) REFERENCES `split_tests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `split_test_days_test_path_date_idx` ON `split_test_days` (`test_id`,`path`,`date`);--> statement-breakpoint
CREATE TABLE `split_test_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`test_id` text NOT NULL,
	`project_id` text NOT NULL,
	`path` text NOT NULL,
	`pair_index` integer NOT NULL,
	`bucket` text NOT NULL,
	`baseline_clicks` integer NOT NULL,
	`baseline_impressions` integer NOT NULL,
	`original_title` text,
	`original_description` text,
	FOREIGN KEY (`test_id`) REFERENCES `split_tests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `split_test_pages_test_path_idx` ON `split_test_pages` (`test_id`,`path`);--> statement-breakpoint
CREATE TABLE `split_test_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`test_id` text NOT NULL,
	`project_id` text NOT NULL,
	`path` text NOT NULL,
	`checked_at` text NOT NULL,
	`expected` text NOT NULL,
	`observed_value` text,
	`passed` integer NOT NULL,
	FOREIGN KEY (`test_id`) REFERENCES `split_tests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `split_test_verifications_test_idx` ON `split_test_verifications` (`test_id`,`checked_at`);--> statement-breakpoint
CREATE TABLE `split_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text,
	`name` text NOT NULL,
	`hypothesis` text NOT NULL,
	`field` text NOT NULL,
	`page_pattern` text NOT NULL,
	`origin` text NOT NULL,
	`status` text NOT NULL,
	`seed` integer,
	`pairs` integer,
	`mde_pct` real,
	`baseline_start` text,
	`baseline_end` text,
	`deployed_at` text,
	`deployment_basis` text,
	`observation_start` text,
	`observation_end` text,
	`proposal_id` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`proposal_id`) REFERENCES `opportunity_proposals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `split_tests_project_idx` ON `split_tests` (`project_id`,`created_at`);