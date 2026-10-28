CREATE TABLE "project_publishing_approvers" (
	"project_id" text NOT NULL,
	"member_id" text NOT NULL,
	"granted_by_user_id" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "project_publishing_approvers_project_id_member_id_pk" PRIMARY KEY("project_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "agency_client_links" (
	"id" text PRIMARY KEY NOT NULL,
	"agency_organization_id" text NOT NULL,
	"client_organization_id" text NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"requested_at" text NOT NULL,
	"accepted_by_user_id" text,
	"accepted_at" text,
	"ended_by_user_id" text,
	"ended_at" text
);
--> statement-breakpoint
CREATE TABLE "organization_branding" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"brand_color" text,
	"logo_data_url" text,
	"updated_by_user_id" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_publishing_approvers" ADD CONSTRAINT "project_publishing_approvers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_publishing_approvers" ADD CONSTRAINT "project_publishing_approvers_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_client_links" ADD CONSTRAINT "agency_client_links_agency_organization_id_organization_id_fk" FOREIGN KEY ("agency_organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_client_links" ADD CONSTRAINT "agency_client_links_client_organization_id_organization_id_fk" FOREIGN KEY ("client_organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_branding" ADD CONSTRAINT "organization_branding_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agency_client_links_open_idx" ON "agency_client_links" USING btree ("agency_organization_id","client_organization_id") WHERE "agency_client_links"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "agency_client_links_client_idx" ON "agency_client_links" USING btree ("client_organization_id");--> statement-breakpoint
-- RFC-0007 6.4: approving pull requests becomes its own permission. Admins
-- who joined before it keep approving until an owner removes it.
UPDATE "member" SET "role" = 'admin,approver' WHERE "role" = 'admin';
