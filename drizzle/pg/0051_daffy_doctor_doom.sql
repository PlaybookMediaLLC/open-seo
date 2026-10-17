CREATE TABLE "content_brief_keywords" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"brief_id" text NOT NULL,
	"keyword" text NOT NULL,
	"search_volume" integer,
	"role" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_briefs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"status" text NOT NULL,
	"title" text NOT NULL,
	"audience" text NOT NULL,
	"search_intent" text NOT NULL,
	"outline_markdown" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"cost_usd" double precision NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_brief_keywords" ADD CONSTRAINT "content_brief_keywords_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_brief_keywords" ADD CONSTRAINT "content_brief_keywords_brief_id_content_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."content_briefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_briefs" ADD CONSTRAINT "content_briefs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_briefs" ADD CONSTRAINT "content_briefs_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_brief_keywords_brief_idx" ON "content_brief_keywords" USING btree ("brief_id");--> statement-breakpoint
CREATE INDEX "content_briefs_opportunity_idx" ON "content_briefs" USING btree ("project_id","opportunity_id","created_at");