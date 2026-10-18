CREATE TABLE `growth_email_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`digest` text NOT NULL,
	`last_sent_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `growth_email_preferences_user_org_idx` ON `growth_email_preferences` (`user_id`,`organization_id`);