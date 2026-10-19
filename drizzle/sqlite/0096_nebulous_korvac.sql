CREATE TABLE `audit_accessibility_headings` (
	`id` text PRIMARY KEY NOT NULL,
	`result_id` text NOT NULL,
	`position` integer NOT NULL,
	`level` integer NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`result_id`) REFERENCES `audit_accessibility_results`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_accessibility_headings_result_idx` ON `audit_accessibility_headings` (`result_id`);