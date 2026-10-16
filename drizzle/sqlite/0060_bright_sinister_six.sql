ALTER TABLE `opportunity_proposals` ADD `title_before` text;--> statement-breakpoint
ALTER TABLE `opportunity_proposals` ADD `title_after` text;--> statement-breakpoint
ALTER TABLE `opportunity_proposals` ADD `title_before_snippet` text;--> statement-breakpoint
ALTER TABLE `opportunity_proposals` ADD `title_after_snippet` text;--> statement-breakpoint
ALTER TABLE `opportunity_proposals` ADD `fingerprint_version` integer DEFAULT 1 NOT NULL;