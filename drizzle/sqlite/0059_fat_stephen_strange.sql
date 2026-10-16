ALTER TABLE `opportunity_proposals` ADD `metadata_source` text DEFAULT 'literal_object' NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunity_proposals` ADD `helper_path` text;--> statement-breakpoint
ALTER TABLE `opportunity_proposals` ADD `helper_blob_sha` text;