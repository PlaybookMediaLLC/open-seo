CREATE TABLE "growth_experiments" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"proposal_id" text NOT NULL,
	"execution_id" text NOT NULL,
	"site_url" text NOT NULL,
	"target_url" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"pull_request_state" text NOT NULL,
	"pull_request_checked_at" text,
	"merged_at" text,
	"merge_commit_sha" text,
	"deployed_at" text,
	"deployment_confirmed_by" text,
	"deployment_note" text,
	"deployment_confirmed_at" text,
	"other_changes" boolean NOT NULL,
	"seasonal_risk" boolean NOT NULL,
	"baseline_start" text,
	"baseline_end" text,
	"observation_start" text,
	"observation_end" text,
	"baseline_run_id" text,
	"last_event_id" text
);
--> statement-breakpoint
CREATE TABLE "measurement_days" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"experiment_id" text NOT NULL,
	"run_id" text NOT NULL,
	"period" text NOT NULL,
	"date" text NOT NULL,
	"clicks" double precision NOT NULL,
	"impressions" double precision NOT NULL,
	"ctr" double precision NOT NULL,
	"position" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurement_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"experiment_id" text NOT NULL,
	"status" text NOT NULL,
	"requested_by" text NOT NULL,
	"started_at" text NOT NULL,
	"finished_at" text,
	"request_count" integer NOT NULL,
	"includes_baseline" boolean NOT NULL,
	"observation_through" text,
	"outcome" text NOT NULL,
	"explanation" text NOT NULL,
	"overlapping_changes" boolean NOT NULL,
	"window_complete" boolean NOT NULL,
	"error" text,
	"claim_token" text NOT NULL,
	"completion_token" text
);
--> statement-breakpoint
ALTER TABLE "growth_experiments" ADD CONSTRAINT "growth_experiments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_experiments" ADD CONSTRAINT "growth_experiments_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_experiments" ADD CONSTRAINT "growth_experiments_proposal_id_opportunity_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."opportunity_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_experiments" ADD CONSTRAINT "growth_experiments_execution_id_proposal_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."proposal_executions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_experiments" ADD CONSTRAINT "growth_experiments_baseline_run_id_measurement_runs_id_fk" FOREIGN KEY ("baseline_run_id") REFERENCES "public"."measurement_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_days" ADD CONSTRAINT "measurement_days_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_days" ADD CONSTRAINT "measurement_days_experiment_id_growth_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."growth_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_days" ADD CONSTRAINT "measurement_days_run_id_measurement_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."measurement_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_runs" ADD CONSTRAINT "measurement_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_runs" ADD CONSTRAINT "measurement_runs_experiment_id_growth_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."growth_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "growth_experiments_execution_idx" ON "growth_experiments" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "growth_experiments_project_created_idx" ON "growth_experiments" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_days_run_period_date_idx" ON "measurement_days" USING btree ("run_id","period","date");--> statement-breakpoint
CREATE INDEX "measurement_days_project_experiment_idx" ON "measurement_days" USING btree ("project_id","experiment_id");--> statement-breakpoint
CREATE INDEX "measurement_runs_project_started_idx" ON "measurement_runs" USING btree ("project_id","started_at");--> statement-breakpoint
CREATE INDEX "measurement_runs_experiment_started_idx" ON "measurement_runs" USING btree ("project_id","experiment_id","started_at");