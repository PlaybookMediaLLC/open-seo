CREATE TABLE "growth_job_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"run_id" text NOT NULL,
	"at" text NOT NULL,
	"level" text NOT NULL,
	"message" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_job_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"schedule_id" text,
	"kind" text NOT NULL,
	"window_key" text NOT NULL,
	"attempt" integer NOT NULL,
	"trigger_run_id" text,
	"status" text NOT NULL,
	"skip_reason" text,
	"started_at" text,
	"finished_at" text,
	"error" text,
	"summary" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_notification_reads" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"notification_id" text NOT NULL,
	"user_id" text NOT NULL,
	"read_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link_path" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"kind" text NOT NULL,
	"enabled" boolean NOT NULL,
	"interval" text NOT NULL,
	"hour_utc" integer NOT NULL,
	"next_run_at" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "growth_job_logs" ADD CONSTRAINT "growth_job_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_job_logs" ADD CONSTRAINT "growth_job_logs_run_id_growth_job_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."growth_job_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_job_runs" ADD CONSTRAINT "growth_job_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_job_runs" ADD CONSTRAINT "growth_job_runs_schedule_id_growth_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."growth_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_notification_reads" ADD CONSTRAINT "growth_notification_reads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_notification_reads" ADD CONSTRAINT "growth_notification_reads_notification_id_growth_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."growth_notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_notifications" ADD CONSTRAINT "growth_notifications_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_notifications" ADD CONSTRAINT "growth_notifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_schedules" ADD CONSTRAINT "growth_schedules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "growth_job_logs_run_idx" ON "growth_job_logs" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_job_runs_window_attempt_idx" ON "growth_job_runs" USING btree ("project_id","kind","window_key","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_job_runs_trigger_run_idx" ON "growth_job_runs" USING btree ("trigger_run_id");--> statement-breakpoint
CREATE INDEX "growth_job_runs_project_created_idx" ON "growth_job_runs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_notification_reads_user_idx" ON "growth_notification_reads" USING btree ("notification_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_notifications_dedupe_idx" ON "growth_notifications" USING btree ("project_id","kind","dedupe_key");--> statement-breakpoint
CREATE INDEX "growth_notifications_org_created_idx" ON "growth_notifications" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "growth_schedules_project_kind_idx" ON "growth_schedules" USING btree ("project_id","kind");--> statement-breakpoint
CREATE INDEX "growth_schedules_due_idx" ON "growth_schedules" USING btree ("enabled","next_run_at");