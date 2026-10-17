CREATE TABLE `experiment_key_events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`experiment_id` text NOT NULL,
	`event_name` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`experiment_id`) REFERENCES `growth_experiments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experiment_key_events_experiment_event_idx` ON `experiment_key_events` (`experiment_id`,`event_name`);--> statement-breakpoint
CREATE TABLE `measurement_ga4_days` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`run_id` text NOT NULL,
	`experiment_id` text NOT NULL,
	`date` text NOT NULL,
	`period` text NOT NULL,
	`sessions` real NOT NULL,
	`engaged_sessions` real NOT NULL,
	`key_events` real NOT NULL,
	`revenue` real,
	`currency` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `measurement_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`experiment_id`) REFERENCES `growth_experiments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `measurement_ga4_days_run_date_idx` ON `measurement_ga4_days` (`run_id`,`date`);--> statement-breakpoint
CREATE INDEX `measurement_ga4_days_experiment_idx` ON `measurement_ga4_days` (`project_id`,`experiment_id`);--> statement-breakpoint
CREATE TABLE `measurement_ga4_event_totals` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`run_id` text NOT NULL,
	`period` text NOT NULL,
	`event_name` text NOT NULL,
	`key_events` real NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `measurement_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `measurement_ga4_event_totals_run_period_event_idx` ON `measurement_ga4_event_totals` (`run_id`,`period`,`event_name`);--> statement-breakpoint
ALTER TABLE `growth_experiments` ADD `ga4_property_id` text;--> statement-breakpoint
ALTER TABLE `growth_experiments` ADD `auto_refresh` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `measurement_runs` ADD `ga4_error` text;