CREATE TABLE "audit_accessibility_headings" (
	"id" text PRIMARY KEY NOT NULL,
	"result_id" text NOT NULL,
	"position" integer NOT NULL,
	"level" integer NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_accessibility_headings" ADD CONSTRAINT "audit_accessibility_headings_result_id_audit_accessibility_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."audit_accessibility_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_accessibility_headings_result_idx" ON "audit_accessibility_headings" USING btree ("result_id");