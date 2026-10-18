CREATE TABLE "project_conversion_events" (
	"project_id" text PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"value_minor" integer,
	"currency" text,
	"created_by" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_conversion_events" ADD CONSTRAINT "project_conversion_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;