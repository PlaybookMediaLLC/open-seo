CREATE TABLE `spend_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text,
	`feature` text,
	`provider` text NOT NULL,
	`actor` text NOT NULL,
	`period_month` text NOT NULL,
	`estimated_credits` integer NOT NULL,
	`actual_credits` integer,
	`cost_usd` real,
	`hold_lock_id` text,
	`status` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL,
	`settled_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spend_ledger_idempotency_key_unique` ON `spend_ledger` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `spend_ledger_organization_period_idx` ON `spend_ledger` (`organization_id`,`period_month`);--> statement-breakpoint
CREATE INDEX `spend_ledger_project_period_idx` ON `spend_ledger` (`project_id`,`period_month`);--> statement-breakpoint
CREATE INDEX `spend_ledger_hold_idx` ON `spend_ledger` (`hold_lock_id`);--> statement-breakpoint
CREATE INDEX `spend_ledger_status_idx` ON `spend_ledger` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `spend_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`project_id` text,
	`monthly_limit_credits` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spend_limits_organization_idx` ON `spend_limits` (`organization_id`) WHERE "spend_limits"."project_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `spend_limits_project_idx` ON `spend_limits` (`organization_id`,`project_id`) WHERE "spend_limits"."project_id" IS NOT NULL;