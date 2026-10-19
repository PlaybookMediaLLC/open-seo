CREATE TABLE `cwv_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`scope` text NOT NULL,
	`target` text NOT NULL,
	`form_factor` text NOT NULL,
	`collection_end` text NOT NULL,
	`lcp_p75_ms` real,
	`inp_p75_ms` real,
	`cls_p75` real,
	`source` text NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cwv_snapshots_target_idx` ON `cwv_snapshots` (`project_id`,`scope`,`target`,`form_factor`,`collection_end`,`source`);