CREATE TABLE "audit_page_inlinks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"audit_id" text NOT NULL,
	"target_page_id" text NOT NULL,
	"source_page_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_audit_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"run_id" text NOT NULL,
	"audit_id" text NOT NULL,
	"audit_issue_id" text,
	"issue_type" text NOT NULL,
	"severity" text NOT NULL,
	"page_url" text NOT NULL,
	"audit_completed_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_inspection_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"run_id" text NOT NULL,
	"url" text NOT NULL,
	"verdict" text,
	"coverage_state" text,
	"indexing_state" text,
	"robots_txt_state" text,
	"page_fetch_state" text,
	"google_canonical" text,
	"user_canonical" text,
	"last_crawl_time" text,
	"inspected_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_link_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"run_id" text NOT NULL,
	"audit_id" text NOT NULL,
	"source_url" text NOT NULL,
	"target_url" text NOT NULL,
	"shared_query" text NOT NULL,
	"source_impressions" double precision NOT NULL,
	"source_position" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_rank_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"run_id" text NOT NULL,
	"tracking_keyword_id" text NOT NULL,
	"device" text NOT NULL,
	"first_position" integer,
	"last_position" integer,
	"first_checked_at" text NOT NULL,
	"last_checked_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunity_runs" ADD COLUMN "audit_id" text;--> statement-breakpoint
ALTER TABLE "opportunity_runs" ADD COLUMN "inspection_requests" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_page_inlinks" ADD CONSTRAINT "audit_page_inlinks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_page_inlinks" ADD CONSTRAINT "audit_page_inlinks_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_page_inlinks" ADD CONSTRAINT "audit_page_inlinks_target_page_id_audit_pages_id_fk" FOREIGN KEY ("target_page_id") REFERENCES "public"."audit_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_page_inlinks" ADD CONSTRAINT "audit_page_inlinks_source_page_id_audit_pages_id_fk" FOREIGN KEY ("source_page_id") REFERENCES "public"."audit_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_audit_evidence" ADD CONSTRAINT "opportunity_audit_evidence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_audit_evidence" ADD CONSTRAINT "opportunity_audit_evidence_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_audit_evidence" ADD CONSTRAINT "opportunity_audit_evidence_run_id_opportunity_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."opportunity_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_audit_evidence" ADD CONSTRAINT "opportunity_audit_evidence_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_audit_evidence" ADD CONSTRAINT "opportunity_audit_evidence_audit_issue_id_audit_issues_id_fk" FOREIGN KEY ("audit_issue_id") REFERENCES "public"."audit_issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_inspection_evidence" ADD CONSTRAINT "opportunity_inspection_evidence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_inspection_evidence" ADD CONSTRAINT "opportunity_inspection_evidence_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_inspection_evidence" ADD CONSTRAINT "opportunity_inspection_evidence_run_id_opportunity_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."opportunity_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_link_evidence" ADD CONSTRAINT "opportunity_link_evidence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_link_evidence" ADD CONSTRAINT "opportunity_link_evidence_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_link_evidence" ADD CONSTRAINT "opportunity_link_evidence_run_id_opportunity_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."opportunity_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_link_evidence" ADD CONSTRAINT "opportunity_link_evidence_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_rank_evidence" ADD CONSTRAINT "opportunity_rank_evidence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_rank_evidence" ADD CONSTRAINT "opportunity_rank_evidence_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_rank_evidence" ADD CONSTRAINT "opportunity_rank_evidence_run_id_opportunity_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."opportunity_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "audit_page_inlinks_audit_target_source_idx" ON "audit_page_inlinks" USING btree ("audit_id","target_page_id","source_page_id");--> statement-breakpoint
CREATE INDEX "audit_page_inlinks_project_audit_idx" ON "audit_page_inlinks" USING btree ("project_id","audit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_audit_evidence_opportunity_run_idx" ON "opportunity_audit_evidence" USING btree ("opportunity_id","run_id");--> statement-breakpoint
CREATE INDEX "opportunity_audit_evidence_project_opportunity_idx" ON "opportunity_audit_evidence" USING btree ("project_id","opportunity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_inspection_evidence_opportunity_run_idx" ON "opportunity_inspection_evidence" USING btree ("opportunity_id","run_id");--> statement-breakpoint
CREATE INDEX "opportunity_inspection_evidence_project_opportunity_idx" ON "opportunity_inspection_evidence" USING btree ("project_id","opportunity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_link_evidence_opportunity_run_idx" ON "opportunity_link_evidence" USING btree ("opportunity_id","run_id");--> statement-breakpoint
CREATE INDEX "opportunity_link_evidence_project_opportunity_idx" ON "opportunity_link_evidence" USING btree ("project_id","opportunity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_rank_evidence_opportunity_run_device_idx" ON "opportunity_rank_evidence" USING btree ("opportunity_id","run_id","device");--> statement-breakpoint
CREATE INDEX "opportunity_rank_evidence_project_opportunity_idx" ON "opportunity_rank_evidence" USING btree ("project_id","opportunity_id");--> statement-breakpoint
ALTER TABLE "opportunity_runs" ADD CONSTRAINT "opportunity_runs_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE set null ON UPDATE no action;