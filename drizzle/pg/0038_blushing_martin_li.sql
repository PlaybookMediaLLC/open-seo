ALTER TABLE "opportunity_proposals" ADD COLUMN "title_before" text;--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD COLUMN "title_after" text;--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD COLUMN "title_before_snippet" text;--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD COLUMN "title_after_snippet" text;--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD COLUMN "fingerprint_version" integer DEFAULT 1 NOT NULL;