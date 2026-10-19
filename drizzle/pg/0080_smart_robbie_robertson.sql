CREATE TABLE "docs_page_headings" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"page_id" text NOT NULL,
	"position" integer NOT NULL,
	"level" integer NOT NULL,
	"text" text NOT NULL,
	"anchor" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docs_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"file_path" text NOT NULL,
	"url_path" text NOT NULL,
	"title" text,
	"word_count" integer NOT NULL,
	"blob_sha" text NOT NULL,
	"indexed_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docs_settings" (
	"project_id" text PRIMARY KEY NOT NULL,
	"path_prefix" text NOT NULL,
	"directory" text NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "docs_page_headings" ADD CONSTRAINT "docs_page_headings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_page_headings" ADD CONSTRAINT "docs_page_headings_page_id_docs_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."docs_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_pages" ADD CONSTRAINT "docs_pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "docs_settings" ADD CONSTRAINT "docs_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "docs_page_headings_page_idx" ON "docs_page_headings" USING btree ("page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "docs_pages_file_idx" ON "docs_pages" USING btree ("project_id","file_path");