CREATE TABLE `proposal_draft_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`draft_id` text NOT NULL,
	`claim_text` text NOT NULL,
	`source_id` text,
	`verified` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`draft_id`) REFERENCES `proposal_drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `proposal_draft_sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `proposal_draft_claims_draft_idx` ON `proposal_draft_claims` (`draft_id`);--> statement-breakpoint
CREATE TABLE `proposal_draft_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`draft_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`excerpt` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`draft_id`) REFERENCES `proposal_drafts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `proposal_draft_sources_draft_idx` ON `proposal_draft_sources` (`draft_id`);--> statement-breakpoint
CREATE TABLE `proposal_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`opportunity_version` integer NOT NULL,
	`evidence_run_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`target_url` text NOT NULL,
	`file_path` text,
	`value_before` text,
	`value_after` text NOT NULL,
	`rationale` text NOT NULL,
	`validation_summary` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`input_digest` text NOT NULL,
	`cost_usd` real NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evidence_run_id`) REFERENCES `opportunity_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `proposal_drafts_project_opportunity_created_idx` ON `proposal_drafts` (`project_id`,`opportunity_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `opportunity_proposals` ADD `draft_id` text REFERENCES proposal_drafts(id) ON DELETE set null;