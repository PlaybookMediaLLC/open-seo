CREATE TABLE "opportunity_accessibility_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"run_id" text NOT NULL,
	"audit_id" text NOT NULL,
	"cluster_key" text NOT NULL,
	"rule_id" text NOT NULL,
	"impact" text NOT NULL,
	"wcag_tags" text NOT NULL,
	"pages_affected" integer NOT NULL,
	"example_url" text NOT NULL,
	"example_selector" text NOT NULL,
	"example_snippet" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunity_accessibility_evidence" ADD CONSTRAINT "opportunity_accessibility_evidence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_accessibility_evidence" ADD CONSTRAINT "opportunity_accessibility_evidence_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_accessibility_evidence" ADD CONSTRAINT "opportunity_accessibility_evidence_run_id_opportunity_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."opportunity_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_accessibility_evidence" ADD CONSTRAINT "opportunity_accessibility_evidence_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_accessibility_evidence_opportunity_run_idx" ON "opportunity_accessibility_evidence" USING btree ("opportunity_id","run_id");