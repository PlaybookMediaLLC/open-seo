CREATE TABLE `accessibility_fix_check_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`check_id` text NOT NULL,
	`url` text NOT NULL,
	`outcome` text NOT NULL,
	`detail` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`check_id`) REFERENCES `accessibility_fix_checks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accessibility_fix_check_pages_check_idx` ON `accessibility_fix_check_pages` (`check_id`);--> statement-breakpoint
CREATE TABLE `accessibility_fix_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`experiment_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`checked_at` text NOT NULL,
	`checked_by` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`experiment_id`) REFERENCES `growth_experiments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accessibility_fix_checks_experiment_idx` ON `accessibility_fix_checks` (`project_id`,`experiment_id`);