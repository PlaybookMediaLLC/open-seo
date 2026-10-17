CREATE TABLE "experiment_key_events" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"experiment_id" text NOT NULL,
	"event_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurement_ga4_days" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"run_id" text NOT NULL,
	"experiment_id" text NOT NULL,
	"date" text NOT NULL,
	"period" text NOT NULL,
	"sessions" double precision NOT NULL,
	"engaged_sessions" double precision NOT NULL,
	"key_events" double precision NOT NULL,
	"revenue" double precision,
	"currency" text
);
--> statement-breakpoint
CREATE TABLE "measurement_ga4_event_totals" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"run_id" text NOT NULL,
	"period" text NOT NULL,
	"event_name" text NOT NULL,
	"key_events" double precision NOT NULL
);
--> statement-breakpoint
ALTER TABLE "growth_experiments" ADD COLUMN "ga4_property_id" text;--> statement-breakpoint
ALTER TABLE "growth_experiments" ADD COLUMN "auto_refresh" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "measurement_runs" ADD COLUMN "ga4_error" text;--> statement-breakpoint
ALTER TABLE "experiment_key_events" ADD CONSTRAINT "experiment_key_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_key_events" ADD CONSTRAINT "experiment_key_events_experiment_id_growth_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."growth_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_ga4_days" ADD CONSTRAINT "measurement_ga4_days_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_ga4_days" ADD CONSTRAINT "measurement_ga4_days_run_id_measurement_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."measurement_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_ga4_days" ADD CONSTRAINT "measurement_ga4_days_experiment_id_growth_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."growth_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_ga4_event_totals" ADD CONSTRAINT "measurement_ga4_event_totals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_ga4_event_totals" ADD CONSTRAINT "measurement_ga4_event_totals_run_id_measurement_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."measurement_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "experiment_key_events_experiment_event_idx" ON "experiment_key_events" USING btree ("experiment_id","event_name");--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_ga4_days_run_date_idx" ON "measurement_ga4_days" USING btree ("run_id","date");--> statement-breakpoint
CREATE INDEX "measurement_ga4_days_experiment_idx" ON "measurement_ga4_days" USING btree ("project_id","experiment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_ga4_event_totals_run_period_event_idx" ON "measurement_ga4_event_totals" USING btree ("run_id","period","event_name");