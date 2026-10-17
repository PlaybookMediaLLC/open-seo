CREATE TABLE `opportunity_investigation_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`investigation_id` text NOT NULL,
	`kind` text NOT NULL,
	`severity` text NOT NULL,
	`summary` text NOT NULL,
	`metric_before` real,
	`metric_after` real,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`investigation_id`) REFERENCES `opportunity_investigations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `opportunity_investigation_findings_investigation_idx` ON `opportunity_investigation_findings` (`investigation_id`);--> statement-breakpoint
CREATE TABLE `opportunity_investigations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`run_id` text NOT NULL,
	`status` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`summary` text,
	`summary_model` text,
	`summary_cost_usd` real,
	`summarized_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `opportunity_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `opportunity_investigations_opportunity_idx` ON `opportunity_investigations` (`project_id`,`opportunity_id`,`created_at`);