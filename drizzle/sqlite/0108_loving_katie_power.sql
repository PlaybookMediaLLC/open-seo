CREATE TABLE `project_publishing_approvers` (
	`project_id` text NOT NULL,
	`member_id` text NOT NULL,
	`granted_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `member_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agency_client_links` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_organization_id` text NOT NULL,
	`client_organization_id` text NOT NULL,
	`requested_by_user_id` text NOT NULL,
	`requested_at` text NOT NULL,
	`accepted_by_user_id` text,
	`accepted_at` text,
	`ended_by_user_id` text,
	`ended_at` text,
	FOREIGN KEY (`agency_organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agency_client_links_open_idx` ON `agency_client_links` (`agency_organization_id`,`client_organization_id`) WHERE "agency_client_links"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX `agency_client_links_client_idx` ON `agency_client_links` (`client_organization_id`);--> statement-breakpoint
CREATE TABLE `organization_branding` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`brand_color` text,
	`logo_data_url` text,
	`updated_by_user_id` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- RFC-0007 6.4: approving pull requests becomes its own permission. Admins
-- who joined before it keep approving until an owner removes it.
UPDATE `member` SET `role` = 'admin,approver' WHERE `role` = 'admin';
