CREATE TABLE `content_brief_keywords` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`brief_id` text NOT NULL,
	`keyword` text NOT NULL,
	`search_volume` integer,
	`role` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`brief_id`) REFERENCES `content_briefs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `content_brief_keywords_brief_idx` ON `content_brief_keywords` (`brief_id`);--> statement-breakpoint
CREATE TABLE `content_briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`status` text NOT NULL,
	`title` text NOT NULL,
	`audience` text NOT NULL,
	`search_intent` text NOT NULL,
	`outline_markdown` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`cost_usd` real NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `content_briefs_opportunity_idx` ON `content_briefs` (`project_id`,`opportunity_id`,`created_at`);