DROP INDEX "opportunity_ga4_evidence_opportunity_run_period_idx";--> statement-breakpoint
ALTER TABLE "opportunity_ga4_evidence" ADD COLUMN "device" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunity_ga4_evidence" ADD COLUMN "engaged_sessions" double precision;--> statement-breakpoint
ALTER TABLE "opportunity_ga4_evidence" ADD COLUMN "key_event_name" text;--> statement-breakpoint
ALTER TABLE "opportunity_ga4_evidence" ADD COLUMN "form_starts" double precision;--> statement-breakpoint
ALTER TABLE "opportunity_ga4_evidence" ADD COLUMN "form_submits" double precision;--> statement-breakpoint
ALTER TABLE "project_conversion_events" ADD COLUMN "channel" text DEFAULT 'organic_search' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_ga4_evidence_opportunity_run_period_idx" ON "opportunity_ga4_evidence" USING btree ("opportunity_id","run_id","period","device");