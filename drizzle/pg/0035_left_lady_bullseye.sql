CREATE TABLE "opportunity_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"evidence_run_id" text NOT NULL,
	"opportunity_version" integer NOT NULL,
	"target_url" text NOT NULL,
	"file_path" text NOT NULL,
	"base_sha" text NOT NULL,
	"before_blob_sha" text NOT NULL,
	"after_blob_sha" text NOT NULL,
	"description_before" text NOT NULL,
	"description_after" text NOT NULL,
	"before_snippet" text NOT NULL,
	"after_snippet" text NOT NULL,
	"change_hash" text NOT NULL,
	"reason" text NOT NULL,
	"expected_effect" text NOT NULL,
	"risk" text NOT NULL,
	"verification_plan" text NOT NULL,
	"validation_summary" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"proposal_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"change_hash" text NOT NULL,
	"note" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_execution_events" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"execution_id" text NOT NULL,
	"phase" text NOT NULL,
	"message" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_executions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"proposal_id" text NOT NULL,
	"approval_id" text NOT NULL,
	"status" text NOT NULL,
	"phase" text NOT NULL,
	"branch_name" text NOT NULL,
	"started_at" text NOT NULL,
	"finished_at" text,
	"request_count" integer NOT NULL,
	"commit_sha" text,
	"pull_request_number" integer,
	"pull_request_url" text,
	"error" text,
	"last_event_id" text
);
--> statement-breakpoint
CREATE TABLE "publishing_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"repository_id" text NOT NULL,
	"owner" text NOT NULL,
	"repository" text NOT NULL,
	"base_branch" text NOT NULL,
	"root_directory" text NOT NULL,
	"encrypted_token" text,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"revoked_at" text,
	"last_event_id" text
);
--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD CONSTRAINT "opportunity_proposals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD CONSTRAINT "opportunity_proposals_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD CONSTRAINT "opportunity_proposals_connection_id_publishing_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."publishing_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_proposals" ADD CONSTRAINT "opportunity_proposals_evidence_run_id_opportunity_runs_id_fk" FOREIGN KEY ("evidence_run_id") REFERENCES "public"."opportunity_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_approvals" ADD CONSTRAINT "proposal_approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_approvals" ADD CONSTRAINT "proposal_approvals_proposal_id_opportunity_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."opportunity_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_execution_events" ADD CONSTRAINT "proposal_execution_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_execution_events" ADD CONSTRAINT "proposal_execution_events_execution_id_proposal_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."proposal_executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_executions" ADD CONSTRAINT "proposal_executions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_executions" ADD CONSTRAINT "proposal_executions_proposal_id_opportunity_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."opportunity_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_executions" ADD CONSTRAINT "proposal_executions_approval_id_proposal_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."proposal_approvals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_connections" ADD CONSTRAINT "publishing_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opportunity_proposals_project_opportunity_idx" ON "opportunity_proposals" USING btree ("project_id","opportunity_id","created_at");--> statement-breakpoint
CREATE INDEX "proposal_approvals_project_proposal_idx" ON "proposal_approvals" USING btree ("project_id","proposal_id");--> statement-breakpoint
CREATE INDEX "proposal_execution_events_project_execution_idx" ON "proposal_execution_events" USING btree ("project_id","execution_id","created_at");--> statement-breakpoint
CREATE INDEX "proposal_executions_project_proposal_idx" ON "proposal_executions" USING btree ("project_id","proposal_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "publishing_connections_active_project_idx" ON "publishing_connections" USING btree ("project_id") WHERE "publishing_connections"."revoked_at" is null;