CREATE TABLE `github_app_installations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`installation_id` integer NOT NULL,
	`account_login` text NOT NULL,
	`account_type` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `github_app_installations_org_idx` ON `github_app_installations` (`organization_id`,`installation_id`);--> statement-breakpoint
ALTER TABLE `publishing_connections` ADD `transport` text DEFAULT 'pat' NOT NULL;--> statement-breakpoint
ALTER TABLE `publishing_connections` ADD `installation_ref` text REFERENCES github_app_installations(id) ON DELETE set null;