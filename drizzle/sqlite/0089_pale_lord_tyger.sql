CREATE TABLE `project_conversion_events` (
	`project_id` text PRIMARY KEY NOT NULL,
	`event_name` text NOT NULL,
	`value_minor` integer,
	`currency` text,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
