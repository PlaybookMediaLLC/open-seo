CREATE TABLE "monitored_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"enrollment_id" text NOT NULL,
	"path" text NOT NULL,
	"selection_reason" text NOT NULL,
	"excluded_reason" text,
	"scope_version" integer NOT NULL,
	"added_by" text NOT NULL,
	"added_at" text NOT NULL,
	"removed_by" text,
	"removed_at" text
);
--> statement-breakpoint
CREATE TABLE "protection_enrollments" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"production_origin" text NOT NULL,
	"status" text DEFAULT 'setup' NOT NULL,
	"scope_version" integer DEFAULT 1 NOT NULL,
	"check_hour_utc" integer NOT NULL,
	"origin_verified_at" text,
	"origin_verified_by" text,
	"reviewer_user_id" text,
	"alert_tested_at" text,
	"alert_confirmed_at" text,
	"allow_repair_proposals" boolean DEFAULT false NOT NULL,
	"allow_pull_requests" boolean DEFAULT false NOT NULL,
	"notes" text,
	"activated_at" text,
	"paused_at" text,
	"ended_at" text,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "protection_enrollments_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "protection_scope_changes" (
	"enrollment_id" text NOT NULL,
	"scope_version" integer NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" text NOT NULL,
	CONSTRAINT "protection_scope_changes_enrollment_id_scope_version_pk" PRIMARY KEY("enrollment_id","scope_version")
);
--> statement-breakpoint
ALTER TABLE "monitored_pages" ADD CONSTRAINT "monitored_pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitored_pages" ADD CONSTRAINT "monitored_pages_enrollment_id_protection_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."protection_enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protection_enrollments" ADD CONSTRAINT "protection_enrollments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protection_scope_changes" ADD CONSTRAINT "protection_scope_changes_enrollment_id_protection_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."protection_enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monitored_pages_active_path_idx" ON "monitored_pages" USING btree ("enrollment_id","path") WHERE "monitored_pages"."removed_at" IS NULL;