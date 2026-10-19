CREATE TABLE "work_cycle_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"cycle_id" text NOT NULL,
	"section" text NOT NULL,
	"rank" integer NOT NULL,
	"opportunity_id" text,
	"proposal_id" text,
	"experiment_id" text,
	"split_test_id" text,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"effort_hours" double precision,
	"approval_needed" text NOT NULL,
	CONSTRAINT "work_cycle_entries_one_link" CHECK ((case when "work_cycle_entries"."opportunity_id" is null then 0 else 1 end + case when "work_cycle_entries"."proposal_id" is null then 0 else 1 end + case when "work_cycle_entries"."experiment_id" is null then 0 else 1 end + case when "work_cycle_entries"."split_test_id" is null then 0 else 1 end) <= 1)
);
--> statement-breakpoint
CREATE TABLE "work_cycles" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"week_start" text NOT NULL,
	"status" text NOT NULL,
	"generated_at" text NOT NULL,
	"closed_at" text,
	"completed_count" integer NOT NULL,
	"measuring_count" integer NOT NULL,
	"next_count" integer NOT NULL,
	"waiting_count" integer NOT NULL,
	"empty_reasons" text
);
--> statement-breakpoint
CREATE TABLE "work_settings" (
	"project_id" text PRIMARY KEY NOT NULL,
	"quality_bar" integer NOT NULL,
	"open_pr_limit" integer NOT NULL,
	"cycle_day" integer NOT NULL,
	"cycle_hour" integer NOT NULL,
	"time_zone" text NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_cycle_entries" ADD CONSTRAINT "work_cycle_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_cycle_entries" ADD CONSTRAINT "work_cycle_entries_cycle_id_work_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."work_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_cycle_entries" ADD CONSTRAINT "work_cycle_entries_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_cycle_entries" ADD CONSTRAINT "work_cycle_entries_proposal_id_opportunity_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."opportunity_proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_cycle_entries" ADD CONSTRAINT "work_cycle_entries_experiment_id_growth_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."growth_experiments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_cycle_entries" ADD CONSTRAINT "work_cycle_entries_split_test_id_split_tests_id_fk" FOREIGN KEY ("split_test_id") REFERENCES "public"."split_tests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_cycles" ADD CONSTRAINT "work_cycles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_settings" ADD CONSTRAINT "work_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_cycle_entries_cycle_idx" ON "work_cycle_entries" USING btree ("cycle_id","section","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "work_cycles_week_idx" ON "work_cycles" USING btree ("project_id","week_start");