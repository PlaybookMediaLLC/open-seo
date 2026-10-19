CREATE TABLE `work_cycle_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`section` text NOT NULL,
	`rank` integer NOT NULL,
	`opportunity_id` text,
	`proposal_id` text,
	`experiment_id` text,
	`split_test_id` text,
	`title` text NOT NULL,
	`reason` text NOT NULL,
	`effort_hours` real,
	`approval_needed` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `work_cycles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`proposal_id`) REFERENCES `opportunity_proposals`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`experiment_id`) REFERENCES `growth_experiments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`split_test_id`) REFERENCES `split_tests`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "work_cycle_entries_one_link" CHECK((case when "work_cycle_entries"."opportunity_id" is null then 0 else 1 end + case when "work_cycle_entries"."proposal_id" is null then 0 else 1 end + case when "work_cycle_entries"."experiment_id" is null then 0 else 1 end + case when "work_cycle_entries"."split_test_id" is null then 0 else 1 end) <= 1)
);
--> statement-breakpoint
CREATE INDEX `work_cycle_entries_cycle_idx` ON `work_cycle_entries` (`cycle_id`,`section`,`rank`);--> statement-breakpoint
CREATE TABLE `work_cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`week_start` text NOT NULL,
	`status` text NOT NULL,
	`generated_at` text NOT NULL,
	`closed_at` text,
	`completed_count` integer NOT NULL,
	`measuring_count` integer NOT NULL,
	`next_count` integer NOT NULL,
	`waiting_count` integer NOT NULL,
	`empty_reasons` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_cycles_week_idx` ON `work_cycles` (`project_id`,`week_start`);--> statement-breakpoint
CREATE TABLE `work_settings` (
	`project_id` text PRIMARY KEY NOT NULL,
	`quality_bar` integer NOT NULL,
	`open_pr_limit` integer NOT NULL,
	`cycle_day` integer NOT NULL,
	`cycle_hour` integer NOT NULL,
	`time_zone` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
