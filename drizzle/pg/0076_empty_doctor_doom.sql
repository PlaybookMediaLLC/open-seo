CREATE TABLE "opportunity_performance_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"run_id" text NOT NULL,
	"template" text NOT NULL,
	"metric" text NOT NULL,
	"form_factor" text NOT NULL,
	"p75_value" double precision NOT NULL,
	"threshold" double precision NOT NULL,
	"scope" text NOT NULL,
	"target" text NOT NULL,
	"collection_end" text NOT NULL,
	"lab_value" double precision,
	"cause_ids" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunity_performance_evidence" ADD CONSTRAINT "opportunity_performance_evidence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_performance_evidence" ADD CONSTRAINT "opportunity_performance_evidence_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_performance_evidence" ADD CONSTRAINT "opportunity_performance_evidence_run_id_opportunity_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."opportunity_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_performance_evidence_opportunity_run_idx" ON "opportunity_performance_evidence" USING btree ("opportunity_id","run_id");