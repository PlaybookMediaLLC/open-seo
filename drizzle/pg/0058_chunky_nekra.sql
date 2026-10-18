CREATE TABLE "ci_check_findings" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"project_id" text NOT NULL,
	"path" text NOT NULL,
	"rule" text NOT NULL,
	"severity" text NOT NULL,
	"before_value" text,
	"after_value" text,
	"message" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ci_check_ignores" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"rule" text NOT NULL,
	"path_pattern" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ci_check_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"token_id" text,
	"repository" text NOT NULL,
	"pull_request" integer,
	"head_sha" text NOT NULL,
	"preview_origin" text NOT NULL,
	"base_origin" text NOT NULL,
	"changed_files" text NOT NULL,
	"status" text NOT NULL,
	"blocking_count" integer DEFAULT 0 NOT NULL,
	"warning_count" integer DEFAULT 0 NOT NULL,
	"url_count" integer DEFAULT 0 NOT NULL,
	"override_used" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"started_at" text,
	"finished_at" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "ci_check_urls" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"project_id" text NOT NULL,
	"path" text NOT NULL,
	"reason" text NOT NULL,
	"base_status" integer,
	"preview_status" integer,
	"clicks_28d" integer,
	"impressions_28d" integer
);
--> statement-breakpoint
CREATE TABLE "ci_preview_access" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"kind" text NOT NULL,
	"header_name" text,
	"encrypted_value" text NOT NULL,
	"key_version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ci_preview_access_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "ci_preview_hosts" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"host" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ci_project_settings" (
	"project_id" text PRIMARY KEY NOT NULL,
	"raise_on_high_traffic" boolean DEFAULT true NOT NULL,
	"check_preview_robots_header" boolean DEFAULT false NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ci_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"display_prefix" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"last_used_at" text,
	"revoked_at" text,
	CONSTRAINT "ci_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "ci_check_findings" ADD CONSTRAINT "ci_check_findings_run_id_ci_check_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ci_check_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_check_ignores" ADD CONSTRAINT "ci_check_ignores_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_check_runs" ADD CONSTRAINT "ci_check_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_check_urls" ADD CONSTRAINT "ci_check_urls_run_id_ci_check_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ci_check_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_preview_access" ADD CONSTRAINT "ci_preview_access_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_preview_hosts" ADD CONSTRAINT "ci_preview_hosts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_project_settings" ADD CONSTRAINT "ci_project_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_tokens" ADD CONSTRAINT "ci_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ci_check_findings_run_idx" ON "ci_check_findings" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ci_check_ignores_project_idx" ON "ci_check_ignores" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ci_check_runs_head_idx" ON "ci_check_runs" USING btree ("project_id","head_sha","preview_origin");--> statement-breakpoint
CREATE INDEX "ci_check_runs_project_created_idx" ON "ci_check_runs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "ci_check_urls_run_idx" ON "ci_check_urls" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ci_preview_hosts_project_host_idx" ON "ci_preview_hosts" USING btree ("project_id","host");--> statement-breakpoint
CREATE INDEX "ci_tokens_project_idx" ON "ci_tokens" USING btree ("project_id");