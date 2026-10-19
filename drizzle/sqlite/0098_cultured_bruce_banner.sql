CREATE TABLE `opportunity_performance_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`run_id` text NOT NULL,
	`template` text NOT NULL,
	`metric` text NOT NULL,
	`form_factor` text NOT NULL,
	`p75_value` real NOT NULL,
	`threshold` real NOT NULL,
	`scope` text NOT NULL,
	`target` text NOT NULL,
	`collection_end` text NOT NULL,
	`lab_value` real,
	`cause_ids` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `opportunity_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opportunity_performance_evidence_opportunity_run_idx` ON `opportunity_performance_evidence` (`opportunity_id`,`run_id`);