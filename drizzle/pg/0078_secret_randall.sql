ALTER TABLE "ci_check_findings" ADD COLUMN "pack" text DEFAULT 'seo' NOT NULL;--> statement-breakpoint
ALTER TABLE "ci_check_runs" ADD COLUMN "gate_config" text;--> statement-breakpoint
ALTER TABLE "ci_check_runs" ADD COLUMN "config_hash" text;--> statement-breakpoint
ALTER TABLE "ci_check_runs" ADD COLUMN "packs_enabled" text DEFAULT 'seo' NOT NULL;--> statement-breakpoint
ALTER TABLE "ci_project_settings" ADD COLUMN "accessibility_pack" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ci_project_settings" ADD COLUMN "links_pack" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ci_project_settings" ADD COLUMN "security_pack" boolean DEFAULT false NOT NULL;