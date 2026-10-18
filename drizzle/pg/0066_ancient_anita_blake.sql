CREATE TABLE "growth_email_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"digest" text NOT NULL,
	"last_sent_at" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "growth_email_preferences" ADD CONSTRAINT "growth_email_preferences_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "growth_email_preferences_user_org_idx" ON "growth_email_preferences" USING btree ("user_id","organization_id");