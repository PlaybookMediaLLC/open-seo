CREATE TABLE "spend_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text,
	"feature" text,
	"provider" text NOT NULL,
	"actor" text NOT NULL,
	"period_month" text NOT NULL,
	"estimated_credits" integer NOT NULL,
	"actual_credits" integer,
	"cost_usd" double precision,
	"hold_lock_id" text,
	"status" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" text NOT NULL,
	"settled_at" text,
	CONSTRAINT "spend_ledger_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "spend_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text,
	"monthly_limit_credits" integer NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "spend_limits" ADD CONSTRAINT "spend_limits_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_limits" ADD CONSTRAINT "spend_limits_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spend_ledger_organization_period_idx" ON "spend_ledger" USING btree ("organization_id","period_month");--> statement-breakpoint
CREATE INDEX "spend_ledger_project_period_idx" ON "spend_ledger" USING btree ("project_id","period_month");--> statement-breakpoint
CREATE INDEX "spend_ledger_hold_idx" ON "spend_ledger" USING btree ("hold_lock_id");--> statement-breakpoint
CREATE INDEX "spend_ledger_status_idx" ON "spend_ledger" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "spend_limits_organization_idx" ON "spend_limits" USING btree ("organization_id") WHERE "spend_limits"."project_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "spend_limits_project_idx" ON "spend_limits" USING btree ("organization_id","project_id") WHERE "spend_limits"."project_id" IS NOT NULL;