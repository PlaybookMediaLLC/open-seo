CREATE TABLE `support_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`provider` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`last_processed_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `support_sources_project_idx` ON `support_sources` (`project_id`,`provider`);--> statement-breakpoint
CREATE TABLE `support_topic_excerpts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `support_topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `support_topic_excerpts_topic_idx` ON `support_topic_excerpts` (`topic_id`);--> statement-breakpoint
CREATE TABLE `support_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`label` text NOT NULL,
	`ticket_count_28d` integer NOT NULL,
	`ticket_count_prev_28d` integer NOT NULL,
	`docs_page_id` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`docs_page_id`) REFERENCES `docs_pages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `support_topics_project_idx` ON `support_topics` (`project_id`);