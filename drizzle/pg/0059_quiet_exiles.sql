CREATE TABLE "ci_webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"received_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ci_check_runs" ADD COLUMN "source" text DEFAULT 'action' NOT NULL;--> statement-breakpoint
ALTER TABLE "ci_check_runs" ADD COLUMN "installation_id" integer;--> statement-breakpoint
ALTER TABLE "ci_check_urls" ADD COLUMN "source_file" text;--> statement-breakpoint
ALTER TABLE "ci_project_settings" ADD COLUMN "rendered_mode" boolean DEFAULT false NOT NULL;