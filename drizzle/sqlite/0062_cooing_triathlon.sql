CREATE TABLE `experiment_deployment_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`experiment_id` text NOT NULL,
	`kind` text NOT NULL,
	`observed_at` text NOT NULL,
	`effective_at` text NOT NULL,
	`environment` text,
	`external_id` text NOT NULL,
	`detail` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`experiment_id`) REFERENCES `growth_experiments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experiment_deployment_signals_unique_idx` ON `experiment_deployment_signals` (`experiment_id`,`kind`,`external_id`);--> statement-breakpoint
ALTER TABLE `growth_experiments` ADD `deployment_basis` text;