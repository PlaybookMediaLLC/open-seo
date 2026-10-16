CREATE TABLE `opportunity_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`text_hash` text NOT NULL,
	`issue_number` integer,
	`issue_url` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `publishing_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opportunity_tickets_text_idx` ON `opportunity_tickets` (`opportunity_id`,`text_hash`);