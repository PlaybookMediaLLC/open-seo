CREATE TABLE "split_test_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"test_id" text NOT NULL,
	"project_id" text NOT NULL,
	"run_at" text NOT NULL,
	"observation_days" integer NOT NULL,
	"estimate_pct" double precision,
	"ci_low_pct" double precision,
	"ci_high_pct" double precision,
	"p_value" double precision,
	"pre_period_p_value" double precision,
	"label" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "split_test_days" (
	"id" text PRIMARY KEY NOT NULL,
	"test_id" text NOT NULL,
	"project_id" text NOT NULL,
	"path" text NOT NULL,
	"date" text NOT NULL,
	"clicks" integer NOT NULL,
	"impressions" integer NOT NULL,
	"position" double precision
);
--> statement-breakpoint
CREATE TABLE "split_test_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"test_id" text NOT NULL,
	"project_id" text NOT NULL,
	"path" text NOT NULL,
	"pair_index" integer NOT NULL,
	"bucket" text NOT NULL,
	"baseline_clicks" integer NOT NULL,
	"baseline_impressions" integer NOT NULL,
	"original_title" text,
	"original_description" text
);
--> statement-breakpoint
CREATE TABLE "split_test_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"test_id" text NOT NULL,
	"project_id" text NOT NULL,
	"path" text NOT NULL,
	"checked_at" text NOT NULL,
	"expected" text NOT NULL,
	"observed_value" text,
	"passed" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "split_tests" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text,
	"name" text NOT NULL,
	"hypothesis" text NOT NULL,
	"field" text NOT NULL,
	"page_pattern" text NOT NULL,
	"origin" text NOT NULL,
	"status" text NOT NULL,
	"seed" integer,
	"pairs" integer,
	"mde_pct" double precision,
	"baseline_start" text,
	"baseline_end" text,
	"deployed_at" text,
	"deployment_basis" text,
	"observation_start" text,
	"observation_end" text,
	"proposal_id" text,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "split_test_analyses" ADD CONSTRAINT "split_test_analyses_test_id_split_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."split_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_test_days" ADD CONSTRAINT "split_test_days_test_id_split_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."split_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_test_pages" ADD CONSTRAINT "split_test_pages_test_id_split_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."split_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_test_verifications" ADD CONSTRAINT "split_test_verifications_test_id_split_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."split_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_tests" ADD CONSTRAINT "split_tests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_tests" ADD CONSTRAINT "split_tests_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_tests" ADD CONSTRAINT "split_tests_proposal_id_opportunity_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."opportunity_proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "split_test_analyses_test_idx" ON "split_test_analyses" USING btree ("test_id","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "split_test_days_test_path_date_idx" ON "split_test_days" USING btree ("test_id","path","date");--> statement-breakpoint
CREATE UNIQUE INDEX "split_test_pages_test_path_idx" ON "split_test_pages" USING btree ("test_id","path");--> statement-breakpoint
CREATE INDEX "split_test_verifications_test_idx" ON "split_test_verifications" USING btree ("test_id","checked_at");--> statement-breakpoint
CREATE INDEX "split_tests_project_idx" ON "split_tests" USING btree ("project_id","created_at");