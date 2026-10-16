CREATE TABLE "opportunity_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"text_hash" text NOT NULL,
	"issue_number" integer,
	"issue_url" text,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunity_tickets" ADD CONSTRAINT "opportunity_tickets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_tickets" ADD CONSTRAINT "opportunity_tickets_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_tickets" ADD CONSTRAINT "opportunity_tickets_connection_id_publishing_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."publishing_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_tickets_text_idx" ON "opportunity_tickets" USING btree ("opportunity_id","text_hash");