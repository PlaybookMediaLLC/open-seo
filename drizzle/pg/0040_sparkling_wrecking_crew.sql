CREATE TABLE "experiment_deployment_signals" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"experiment_id" text NOT NULL,
	"kind" text NOT NULL,
	"observed_at" text NOT NULL,
	"effective_at" text NOT NULL,
	"environment" text,
	"external_id" text NOT NULL,
	"detail" text NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "growth_experiments" ADD COLUMN "deployment_basis" text;--> statement-breakpoint
ALTER TABLE "experiment_deployment_signals" ADD CONSTRAINT "experiment_deployment_signals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_deployment_signals" ADD CONSTRAINT "experiment_deployment_signals_experiment_id_growth_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."growth_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "experiment_deployment_signals_unique_idx" ON "experiment_deployment_signals" USING btree ("experiment_id","kind","external_id");