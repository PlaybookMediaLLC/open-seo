ALTER TABLE "opportunity_proposals" ADD COLUMN "metadata_source" text DEFAULT 'literal_object' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD COLUMN "helper_path" text;--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD COLUMN "helper_blob_sha" text;