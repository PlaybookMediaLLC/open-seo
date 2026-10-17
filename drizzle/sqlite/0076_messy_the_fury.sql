CREATE TABLE `growth_job_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`run_id` text NOT NULL,
	`at` text NOT NULL,
	`level` text NOT NULL,
	`message` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `growth_job_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `growth_job_logs_run_idx` ON `growth_job_logs` (`run_id`);--> statement-breakpoint
CREATE TABLE `growth_job_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`schedule_id` text,
	`kind` text NOT NULL,
	`window_key` text NOT NULL,
	`attempt` integer NOT NULL,
	`trigger_run_id` text,
	`status` text NOT NULL,
	`skip_reason` text,
	`started_at` text,
	`finished_at` text,
	`error` text,
	`summary` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`schedule_id`) REFERENCES `growth_schedules`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `growth_job_runs_window_attempt_idx` ON `growth_job_runs` (`project_id`,`kind`,`window_key`,`attempt`);--> statement-breakpoint
CREATE UNIQUE INDEX `growth_job_runs_trigger_run_idx` ON `growth_job_runs` (`trigger_run_id`);--> statement-breakpoint
CREATE INDEX `growth_job_runs_project_created_idx` ON `growth_job_runs` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `growth_notification_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`notification_id` text NOT NULL,
	`user_id` text NOT NULL,
	`read_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`notification_id`) REFERENCES `growth_notifications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `growth_notification_reads_user_idx` ON `growth_notification_reads` (`notification_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `growth_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`link_path` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `growth_notifications_dedupe_idx` ON `growth_notifications` (`project_id`,`kind`,`dedupe_key`);--> statement-breakpoint
CREATE INDEX `growth_notifications_org_created_idx` ON `growth_notifications` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `growth_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`enabled` integer NOT NULL,
	`interval` text NOT NULL,
	`hour_utc` integer NOT NULL,
	`next_run_at` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `growth_schedules_project_kind_idx` ON `growth_schedules` (`project_id`,`kind`);--> statement-breakpoint
CREATE INDEX `growth_schedules_due_idx` ON `growth_schedules` (`enabled`,`next_run_at`);