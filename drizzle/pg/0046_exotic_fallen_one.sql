CREATE TABLE "opportunity_ga4_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"run_id" text NOT NULL,
	"period" text NOT NULL,
	"landing_page" text NOT NULL,
	"sessions" double precision NOT NULL,
	"key_events" double precision NOT NULL,
	"revenue" double precision,
	"currency" text
);
--> statement-breakpoint
CREATE TABLE "opportunity_urls" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"url" text NOT NULL,
	"role" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_brand_terms" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"term" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
DROP INDEX "opportunity_evidence_opportunity_run_period_idx";--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "diagnosis" text;--> statement-breakpoint
ALTER TABLE "opportunity_evidence" ADD COLUMN "url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunity_evidence" ADD COLUMN "query" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunity_runs" ADD COLUMN "kind" text DEFAULT 'search_console' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunity_runs" ADD COLUMN "year_ago_page_rows" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunity_runs" ADD COLUMN "ga4_property_id" text;--> statement-breakpoint
ALTER TABLE "opportunity_ga4_evidence" ADD CONSTRAINT "opportunity_ga4_evidence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_ga4_evidence" ADD CONSTRAINT "opportunity_ga4_evidence_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_ga4_evidence" ADD CONSTRAINT "opportunity_ga4_evidence_run_id_opportunity_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."opportunity_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_urls" ADD CONSTRAINT "opportunity_urls_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_urls" ADD CONSTRAINT "opportunity_urls_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_brand_terms" ADD CONSTRAINT "project_brand_terms_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_ga4_evidence_opportunity_run_period_idx" ON "opportunity_ga4_evidence" USING btree ("opportunity_id","run_id","period");--> statement-breakpoint
CREATE INDEX "opportunity_ga4_evidence_project_opportunity_idx" ON "opportunity_ga4_evidence" USING btree ("project_id","opportunity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_urls_opportunity_url_role_idx" ON "opportunity_urls" USING btree ("opportunity_id","url","role");--> statement-breakpoint
CREATE INDEX "opportunity_urls_project_opportunity_idx" ON "opportunity_urls" USING btree ("project_id","opportunity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_brand_terms_project_term_idx" ON "project_brand_terms" USING btree ("project_id","term");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_evidence_run_period_url_query_idx" ON "opportunity_evidence" USING btree ("opportunity_id","run_id","period","url","query");