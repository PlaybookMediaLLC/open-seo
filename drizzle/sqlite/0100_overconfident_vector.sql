ALTER TABLE `ci_check_findings` ADD `pack` text DEFAULT 'seo' NOT NULL;--> statement-breakpoint
ALTER TABLE `ci_check_runs` ADD `gate_config` text;--> statement-breakpoint
ALTER TABLE `ci_check_runs` ADD `config_hash` text;--> statement-breakpoint
ALTER TABLE `ci_check_runs` ADD `packs_enabled` text DEFAULT 'seo' NOT NULL;--> statement-breakpoint
ALTER TABLE `ci_project_settings` ADD `accessibility_pack` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `ci_project_settings` ADD `links_pack` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `ci_project_settings` ADD `security_pack` integer DEFAULT false NOT NULL;