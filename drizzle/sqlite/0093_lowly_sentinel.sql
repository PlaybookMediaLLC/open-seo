CREATE TABLE `audit_accessibility_results` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_id` text NOT NULL,
	`page_id` text NOT NULL,
	`axe_version` text NOT NULL,
	`ran_at` text NOT NULL,
	`violation_count` integer NOT NULL,
	`error` text,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `audit_pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_accessibility_results_audit_idx` ON `audit_accessibility_results` (`audit_id`);--> statement-breakpoint
CREATE TABLE `audit_accessibility_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_id` text NOT NULL,
	`url` text NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_accessibility_targets_audit_idx` ON `audit_accessibility_targets` (`audit_id`);--> statement-breakpoint
CREATE TABLE `audit_accessibility_violations` (
	`id` text PRIMARY KEY NOT NULL,
	`result_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`impact` text NOT NULL,
	`wcag_tags` text NOT NULL,
	`target_selector` text NOT NULL,
	`html_snippet` text NOT NULL,
	`failure_summary` text NOT NULL,
	`cluster_key` text NOT NULL,
	FOREIGN KEY (`result_id`) REFERENCES `audit_accessibility_results`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_accessibility_violations_result_idx` ON `audit_accessibility_violations` (`result_id`);--> statement-breakpoint
CREATE INDEX `audit_accessibility_violations_cluster_idx` ON `audit_accessibility_violations` (`cluster_key`);