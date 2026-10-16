CREATE TABLE `audit_page_inlinks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`audit_id` text NOT NULL,
	`target_page_id` text NOT NULL,
	`source_page_id` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_page_id`) REFERENCES `audit_pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_page_id`) REFERENCES `audit_pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_page_inlinks_audit_target_source_idx` ON `audit_page_inlinks` (`audit_id`,`target_page_id`,`source_page_id`);--> statement-breakpoint
CREATE INDEX `audit_page_inlinks_project_audit_idx` ON `audit_page_inlinks` (`project_id`,`audit_id`);--> statement-breakpoint
CREATE TABLE `opportunity_audit_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`run_id` text NOT NULL,
	`audit_id` text NOT NULL,
	`audit_issue_id` text,
	`issue_type` text NOT NULL,
	`severity` text NOT NULL,
	`page_url` text NOT NULL,
	`audit_completed_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `opportunity_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`audit_issue_id`) REFERENCES `audit_issues`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opportunity_audit_evidence_opportunity_run_idx` ON `opportunity_audit_evidence` (`opportunity_id`,`run_id`);--> statement-breakpoint
CREATE INDEX `opportunity_audit_evidence_project_opportunity_idx` ON `opportunity_audit_evidence` (`project_id`,`opportunity_id`);--> statement-breakpoint
CREATE TABLE `opportunity_inspection_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`run_id` text NOT NULL,
	`url` text NOT NULL,
	`verdict` text,
	`coverage_state` text,
	`indexing_state` text,
	`robots_txt_state` text,
	`page_fetch_state` text,
	`google_canonical` text,
	`user_canonical` text,
	`last_crawl_time` text,
	`inspected_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `opportunity_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opportunity_inspection_evidence_opportunity_run_idx` ON `opportunity_inspection_evidence` (`opportunity_id`,`run_id`);--> statement-breakpoint
CREATE INDEX `opportunity_inspection_evidence_project_opportunity_idx` ON `opportunity_inspection_evidence` (`project_id`,`opportunity_id`);--> statement-breakpoint
CREATE TABLE `opportunity_link_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`run_id` text NOT NULL,
	`audit_id` text NOT NULL,
	`source_url` text NOT NULL,
	`target_url` text NOT NULL,
	`shared_query` text NOT NULL,
	`source_impressions` real NOT NULL,
	`source_position` real NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `opportunity_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opportunity_link_evidence_opportunity_run_idx` ON `opportunity_link_evidence` (`opportunity_id`,`run_id`);--> statement-breakpoint
CREATE INDEX `opportunity_link_evidence_project_opportunity_idx` ON `opportunity_link_evidence` (`project_id`,`opportunity_id`);--> statement-breakpoint
CREATE TABLE `opportunity_rank_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`run_id` text NOT NULL,
	`tracking_keyword_id` text NOT NULL,
	`device` text NOT NULL,
	`first_position` integer,
	`last_position` integer,
	`first_checked_at` text NOT NULL,
	`last_checked_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `opportunity_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opportunity_rank_evidence_opportunity_run_device_idx` ON `opportunity_rank_evidence` (`opportunity_id`,`run_id`,`device`);--> statement-breakpoint
CREATE INDEX `opportunity_rank_evidence_project_opportunity_idx` ON `opportunity_rank_evidence` (`project_id`,`opportunity_id`);--> statement-breakpoint
ALTER TABLE `opportunity_runs` ADD `audit_id` text REFERENCES audits(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `opportunity_runs` ADD `inspection_requests` integer DEFAULT 0 NOT NULL;