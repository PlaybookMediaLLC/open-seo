CREATE TABLE "revenue_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"provider" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_version" integer NOT NULL,
	"hash_salt" text NOT NULL,
	"account_id_hash" text,
	"livemode" boolean NOT NULL,
	"sync_cursor" integer,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"last_synced_at" text,
	CONSTRAINT "revenue_connections_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "revenue_events" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"external_id_hash" text NOT NULL,
	"customer_hash" text NOT NULL,
	"kind" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"occurred_at" text NOT NULL,
	"ft_path" text,
	"ft_source" text,
	"ft_medium" text,
	"ft_campaign" text,
	"ft_channel" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "revenue_connections" ADD CONSTRAINT "revenue_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_events" ADD CONSTRAINT "revenue_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_events_external_idx" ON "revenue_events" USING btree ("project_id","external_id_hash");--> statement-breakpoint
CREATE INDEX "revenue_events_project_time_idx" ON "revenue_events" USING btree ("project_id","occurred_at");