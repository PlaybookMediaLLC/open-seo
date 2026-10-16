ALTER TABLE "opportunity_proposals" ADD COLUMN "canonical_before" text;--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD COLUMN "canonical_after" text;--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD COLUMN "canonical_before_snippet" text;--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD COLUMN "canonical_after_snippet" text;--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD COLUMN "robots_before" text;--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD COLUMN "robots_after" text;--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD COLUMN "robots_before_snippet" text;--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD COLUMN "robots_after_snippet" text;