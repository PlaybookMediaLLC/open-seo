CREATE TABLE `opportunity_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`evidence_run_id` text NOT NULL,
	`opportunity_version` integer NOT NULL,
	`target_url` text NOT NULL,
	`file_path` text NOT NULL,
	`base_sha` text NOT NULL,
	`before_blob_sha` text NOT NULL,
	`after_blob_sha` text NOT NULL,
	`description_before` text NOT NULL,
	`description_after` text NOT NULL,
	`before_snippet` text NOT NULL,
	`after_snippet` text NOT NULL,
	`change_hash` text NOT NULL,
	`reason` text NOT NULL,
	`expected_effect` text NOT NULL,
	`risk` text NOT NULL,
	`verification_plan` text NOT NULL,
	`validation_summary` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `publishing_connections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evidence_run_id`) REFERENCES `opportunity_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `opportunity_proposals_project_opportunity_idx` ON `opportunity_proposals` (`project_id`,`opportunity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `proposal_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`proposal_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`change_hash` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proposal_id`) REFERENCES `opportunity_proposals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `proposal_approvals_project_proposal_idx` ON `proposal_approvals` (`project_id`,`proposal_id`);--> statement-breakpoint
CREATE TABLE `proposal_execution_events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`execution_id` text NOT NULL,
	`phase` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`execution_id`) REFERENCES `proposal_executions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `proposal_execution_events_project_execution_idx` ON `proposal_execution_events` (`project_id`,`execution_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `proposal_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`proposal_id` text NOT NULL,
	`approval_id` text NOT NULL,
	`status` text NOT NULL,
	`phase` text NOT NULL,
	`branch_name` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`request_count` integer NOT NULL,
	`commit_sha` text,
	`pull_request_number` integer,
	`pull_request_url` text,
	`error` text,
	`last_event_id` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proposal_id`) REFERENCES `opportunity_proposals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approval_id`) REFERENCES `proposal_approvals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `proposal_executions_project_proposal_idx` ON `proposal_executions` (`project_id`,`proposal_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `publishing_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`repository_id` text NOT NULL,
	`owner` text NOT NULL,
	`repository` text NOT NULL,
	`base_branch` text NOT NULL,
	`root_directory` text NOT NULL,
	`encrypted_token` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text,
	`last_event_id` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `publishing_connections_active_project_idx` ON `publishing_connections` (`project_id`) WHERE "publishing_connections"."revoked_at" is null;