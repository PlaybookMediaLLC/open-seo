CREATE TABLE "opportunity_investigation_findings" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"investigation_id" text NOT NULL,
	"kind" text NOT NULL,
	"severity" text NOT NULL,
	"summary" text NOT NULL,
	"metric_before" double precision,
	"metric_after" double precision
);
--> statement-breakpoint
CREATE TABLE "opportunity_investigations" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"run_id" text NOT NULL,
	"status" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"summary" text,
	"summary_model" text,
	"summary_cost_usd" double precision,
	"summarized_at" text
);
--> statement-breakpoint
ALTER TABLE "opportunity_investigation_findings" ADD CONSTRAINT "opportunity_investigation_findings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_investigation_findings" ADD CONSTRAINT "opportunity_investigation_findings_investigation_id_opportunity_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."opportunity_investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_investigations" ADD CONSTRAINT "opportunity_investigations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_investigations" ADD CONSTRAINT "opportunity_investigations_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_investigations" ADD CONSTRAINT "opportunity_investigations_run_id_opportunity_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."opportunity_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opportunity_investigation_findings_investigation_idx" ON "opportunity_investigation_findings" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "opportunity_investigations_opportunity_idx" ON "opportunity_investigations" USING btree ("project_id","opportunity_id","created_at");