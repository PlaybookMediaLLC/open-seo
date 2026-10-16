CREATE TABLE "proposal_draft_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"draft_id" text NOT NULL,
	"claim_text" text NOT NULL,
	"source_id" text,
	"verified" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_draft_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"draft_id" text NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"excerpt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"opportunity_version" integer NOT NULL,
	"evidence_run_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"target_url" text NOT NULL,
	"file_path" text,
	"value_before" text,
	"value_after" text NOT NULL,
	"rationale" text NOT NULL,
	"validation_summary" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_digest" text NOT NULL,
	"cost_usd" double precision NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD COLUMN "draft_id" text;--> statement-breakpoint
ALTER TABLE "proposal_draft_claims" ADD CONSTRAINT "proposal_draft_claims_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_draft_claims" ADD CONSTRAINT "proposal_draft_claims_draft_id_proposal_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."proposal_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_draft_claims" ADD CONSTRAINT "proposal_draft_claims_source_id_proposal_draft_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."proposal_draft_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_draft_sources" ADD CONSTRAINT "proposal_draft_sources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_draft_sources" ADD CONSTRAINT "proposal_draft_sources_draft_id_proposal_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."proposal_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_drafts" ADD CONSTRAINT "proposal_drafts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_drafts" ADD CONSTRAINT "proposal_drafts_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_drafts" ADD CONSTRAINT "proposal_drafts_evidence_run_id_opportunity_runs_id_fk" FOREIGN KEY ("evidence_run_id") REFERENCES "public"."opportunity_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proposal_draft_claims_draft_idx" ON "proposal_draft_claims" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "proposal_draft_sources_draft_idx" ON "proposal_draft_sources" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "proposal_drafts_project_opportunity_created_idx" ON "proposal_drafts" USING btree ("project_id","opportunity_id","created_at");--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD CONSTRAINT "opportunity_proposals_draft_id_proposal_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."proposal_drafts"("id") ON DELETE set null ON UPDATE no action;