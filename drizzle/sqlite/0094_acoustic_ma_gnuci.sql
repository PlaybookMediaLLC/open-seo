CREATE TABLE `opportunity_accessibility_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`run_id` text NOT NULL,
	`audit_id` text NOT NULL,
	`cluster_key` text NOT NULL,
	`rule_id` text NOT NULL,
	`impact` text NOT NULL,
	`wcag_tags` text NOT NULL,
	`pages_affected` integer NOT NULL,
	`example_url` text NOT NULL,
	`example_selector` text NOT NULL,
	`example_snippet` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `opportunity_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opportunity_accessibility_evidence_opportunity_run_idx` ON `opportunity_accessibility_evidence` (`opportunity_id`,`run_id`);