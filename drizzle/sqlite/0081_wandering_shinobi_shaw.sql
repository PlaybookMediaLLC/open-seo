CREATE TABLE `ci_webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`received_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `ci_check_runs` ADD `source` text DEFAULT 'action' NOT NULL;--> statement-breakpoint
ALTER TABLE `ci_check_runs` ADD `installation_id` integer;--> statement-breakpoint
ALTER TABLE `ci_check_urls` ADD `source_file` text;--> statement-breakpoint
ALTER TABLE `ci_project_settings` ADD `rendered_mode` integer DEFAULT false NOT NULL;