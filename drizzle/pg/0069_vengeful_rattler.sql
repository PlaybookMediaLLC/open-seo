CREATE TABLE "proposal_text_edits" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"proposal_id" text NOT NULL,
	"ordinal" integer NOT NULL,
	"file_path" text NOT NULL,
	"node_kind" text NOT NULL,
	"before_blob_sha" text NOT NULL,
	"after_blob_sha" text NOT NULL,
	"before_text" text NOT NULL,
	"after_text" text NOT NULL,
	"before_snippet" text NOT NULL,
	"after_snippet" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD COLUMN "change_kind" text DEFAULT 'metadata' NOT NULL;--> statement-breakpoint
ALTER TABLE "proposal_text_edits" ADD CONSTRAINT "proposal_text_edits_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_text_edits" ADD CONSTRAINT "proposal_text_edits_proposal_id_opportunity_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."opportunity_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_text_edits_proposal_ordinal_idx" ON "proposal_text_edits" USING btree ("proposal_id","ordinal");