CREATE TABLE "support_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"provider" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"last_processed_at" text
);
--> statement-breakpoint
CREATE TABLE "support_topic_excerpts" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"label" text NOT NULL,
	"ticket_count_28d" integer NOT NULL,
	"ticket_count_prev_28d" integer NOT NULL,
	"docs_page_id" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_sources" ADD CONSTRAINT "support_sources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_topic_excerpts" ADD CONSTRAINT "support_topic_excerpts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_topic_excerpts" ADD CONSTRAINT "support_topic_excerpts_topic_id_support_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."support_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_topics" ADD CONSTRAINT "support_topics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_topics" ADD CONSTRAINT "support_topics_docs_page_id_docs_pages_id_fk" FOREIGN KEY ("docs_page_id") REFERENCES "public"."docs_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "support_sources_project_idx" ON "support_sources" USING btree ("project_id","provider");--> statement-breakpoint
CREATE INDEX "support_topic_excerpts_topic_idx" ON "support_topic_excerpts" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "support_topics_project_idx" ON "support_topics" USING btree ("project_id");