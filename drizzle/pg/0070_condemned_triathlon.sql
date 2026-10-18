ALTER TABLE "split_tests" ADD COLUMN "metric" text DEFAULT 'clicks' NOT NULL;--> statement-breakpoint
ALTER TABLE "split_tests" ADD COLUMN "metric_event" text;