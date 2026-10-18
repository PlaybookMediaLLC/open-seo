CREATE TABLE `proposal_text_edits` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`proposal_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`file_path` text NOT NULL,
	`node_kind` text NOT NULL,
	`before_blob_sha` text NOT NULL,
	`after_blob_sha` text NOT NULL,
	`before_text` text NOT NULL,
	`after_text` text NOT NULL,
	`before_snippet` text NOT NULL,
	`after_snippet` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proposal_id`) REFERENCES `opportunity_proposals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proposal_text_edits_proposal_ordinal_idx` ON `proposal_text_edits` (`proposal_id`,`ordinal`);--> statement-breakpoint
ALTER TABLE `opportunity_proposals` ADD `change_kind` text DEFAULT 'metadata' NOT NULL;