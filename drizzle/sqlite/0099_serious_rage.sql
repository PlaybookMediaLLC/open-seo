CREATE TABLE `performance_lab_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`url` text NOT NULL,
	`ran_at` text NOT NULL,
	`ran_by` text NOT NULL,
	`runs` integer NOT NULL,
	`lcp_ms` real,
	`cls` real,
	`tbt_ms` real,
	`performance_score` real,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `performance_lab_checks_opportunity_idx` ON `performance_lab_checks` (`project_id`,`opportunity_id`);