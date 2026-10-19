CREATE TABLE "performance_lab_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"url" text NOT NULL,
	"ran_at" text NOT NULL,
	"ran_by" text NOT NULL,
	"runs" integer NOT NULL,
	"lcp_ms" double precision,
	"cls" double precision,
	"tbt_ms" double precision,
	"performance_score" double precision
);
--> statement-breakpoint
ALTER TABLE "performance_lab_checks" ADD CONSTRAINT "performance_lab_checks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_lab_checks" ADD CONSTRAINT "performance_lab_checks_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "performance_lab_checks_opportunity_idx" ON "performance_lab_checks" USING btree ("project_id","opportunity_id");