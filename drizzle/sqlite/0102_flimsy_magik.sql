CREATE TABLE `docs_page_headings` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`page_id` text NOT NULL,
	`position` integer NOT NULL,
	`level` integer NOT NULL,
	`text` text NOT NULL,
	`anchor` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `docs_pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `docs_page_headings_page_idx` ON `docs_page_headings` (`page_id`);--> statement-breakpoint
CREATE TABLE `docs_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`file_path` text NOT NULL,
	`url_path` text NOT NULL,
	`title` text,
	`word_count` integer NOT NULL,
	`blob_sha` text NOT NULL,
	`indexed_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `docs_pages_file_idx` ON `docs_pages` (`project_id`,`file_path`);--> statement-breakpoint
CREATE TABLE `docs_settings` (
	`project_id` text PRIMARY KEY NOT NULL,
	`path_prefix` text NOT NULL,
	`directory` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
