CREATE TABLE "cwv_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"scope" text NOT NULL,
	"target" text NOT NULL,
	"form_factor" text NOT NULL,
	"collection_end" text NOT NULL,
	"lcp_p75_ms" double precision,
	"inp_p75_ms" double precision,
	"cls_p75" double precision,
	"source" text NOT NULL,
	"fetched_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cwv_snapshots" ADD CONSTRAINT "cwv_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cwv_snapshots_target_idx" ON "cwv_snapshots" USING btree ("project_id","scope","target","form_factor","collection_end","source");