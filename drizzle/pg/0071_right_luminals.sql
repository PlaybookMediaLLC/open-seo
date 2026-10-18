CREATE TABLE "audit_accessibility_results" (
	"id" text PRIMARY KEY NOT NULL,
	"audit_id" text NOT NULL,
	"page_id" text NOT NULL,
	"axe_version" text NOT NULL,
	"ran_at" text NOT NULL,
	"violation_count" integer NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "audit_accessibility_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"audit_id" text NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_accessibility_violations" (
	"id" text PRIMARY KEY NOT NULL,
	"result_id" text NOT NULL,
	"rule_id" text NOT NULL,
	"impact" text NOT NULL,
	"wcag_tags" text NOT NULL,
	"target_selector" text NOT NULL,
	"html_snippet" text NOT NULL,
	"failure_summary" text NOT NULL,
	"cluster_key" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_accessibility_results" ADD CONSTRAINT "audit_accessibility_results_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_accessibility_results" ADD CONSTRAINT "audit_accessibility_results_page_id_audit_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."audit_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_accessibility_targets" ADD CONSTRAINT "audit_accessibility_targets_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_accessibility_violations" ADD CONSTRAINT "audit_accessibility_violations_result_id_audit_accessibility_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."audit_accessibility_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_accessibility_results_audit_idx" ON "audit_accessibility_results" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "audit_accessibility_targets_audit_idx" ON "audit_accessibility_targets" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "audit_accessibility_violations_result_idx" ON "audit_accessibility_violations" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "audit_accessibility_violations_cluster_idx" ON "audit_accessibility_violations" USING btree ("cluster_key");