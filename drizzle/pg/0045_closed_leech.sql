CREATE TABLE "github_app_installations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"installation_id" integer NOT NULL,
	"account_login" text NOT NULL,
	"account_type" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"revoked_at" text
);
--> statement-breakpoint
ALTER TABLE "publishing_connections" ADD COLUMN "transport" text DEFAULT 'pat' NOT NULL;--> statement-breakpoint
ALTER TABLE "publishing_connections" ADD COLUMN "installation_ref" text;--> statement-breakpoint
ALTER TABLE "github_app_installations" ADD CONSTRAINT "github_app_installations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "github_app_installations_org_idx" ON "github_app_installations" USING btree ("organization_id","installation_id");--> statement-breakpoint
ALTER TABLE "publishing_connections" ADD CONSTRAINT "publishing_connections_installation_ref_github_app_installations_id_fk" FOREIGN KEY ("installation_ref") REFERENCES "public"."github_app_installations"("id") ON DELETE set null ON UPDATE no action;