CREATE TABLE "opportunities" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"site_url" text NOT NULL,
	"identity_key" text NOT NULL,
	"type" text NOT NULL,
	"url" text NOT NULL,
	"query" text,
	"title" text NOT NULL,
	"explanation" text NOT NULL,
	"recommended_action" text NOT NULL,
	"search_intent" text NOT NULL,
	"confidence" double precision NOT NULL,
	"effort_hours" double precision NOT NULL,
	"priority" integer NOT NULL,
	"commercial_score" double precision NOT NULL,
	"demand_score" double precision NOT NULL,
	"visibility_score" double precision NOT NULL,
	"difficulty_score" double precision NOT NULL,
	"effort_score" double precision NOT NULL,
	"score_explanation" text NOT NULL,
	"uncertainty" text NOT NULL,
	"status" text DEFAULT 'discovered' NOT NULL,
	"owner_user_id" text,
	"evidence_run_id" text NOT NULL,
	"first_detected_at" text NOT NULL,
	"last_detected_at" text NOT NULL,
	"deferred_until" text,
	"version" integer DEFAULT 1 NOT NULL,
	"last_decision_id" text
);
--> statement-breakpoint
CREATE TABLE "opportunity_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"evidence_run_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"decision" text NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"note" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"run_id" text NOT NULL,
	"source" text NOT NULL,
	"period" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"clicks" double precision NOT NULL,
	"impressions" double precision NOT NULL,
	"ctr" double precision NOT NULL,
	"position" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"site_url" text NOT NULL,
	"status" text NOT NULL,
	"requested_by" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"previous_start_date" text NOT NULL,
	"previous_end_date" text NOT NULL,
	"started_at" text NOT NULL,
	"finished_at" text,
	"query_rows" integer DEFAULT 0 NOT NULL,
	"current_page_rows" integer DEFAULT 0 NOT NULL,
	"previous_page_rows" integer DEFAULT 0 NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"opportunity_count" integer DEFAULT 0 NOT NULL,
	"truncated" boolean DEFAULT false NOT NULL,
	"error" text,
	"completion_token" text
);
--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_evidence_run_id_opportunity_runs_id_fk" FOREIGN KEY ("evidence_run_id") REFERENCES "public"."opportunity_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_decisions" ADD CONSTRAINT "opportunity_decisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_decisions" ADD CONSTRAINT "opportunity_decisions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_decisions" ADD CONSTRAINT "opportunity_decisions_evidence_run_id_opportunity_runs_id_fk" FOREIGN KEY ("evidence_run_id") REFERENCES "public"."opportunity_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_evidence" ADD CONSTRAINT "opportunity_evidence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_evidence" ADD CONSTRAINT "opportunity_evidence_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_evidence" ADD CONSTRAINT "opportunity_evidence_run_id_opportunity_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."opportunity_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_runs" ADD CONSTRAINT "opportunity_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "opportunities_project_identity_idx" ON "opportunities" USING btree ("project_id","identity_key");--> statement-breakpoint
CREATE INDEX "opportunities_project_status_priority_idx" ON "opportunities" USING btree ("project_id","status","priority");--> statement-breakpoint
CREATE INDEX "opportunity_decisions_project_opportunity_idx" ON "opportunity_decisions" USING btree ("project_id","opportunity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_evidence_opportunity_run_period_idx" ON "opportunity_evidence" USING btree ("opportunity_id","run_id","period");--> statement-breakpoint
CREATE INDEX "opportunity_evidence_project_opportunity_idx" ON "opportunity_evidence" USING btree ("project_id","opportunity_id");--> statement-breakpoint
CREATE INDEX "opportunity_runs_project_started_idx" ON "opportunity_runs" USING btree ("project_id","started_at");