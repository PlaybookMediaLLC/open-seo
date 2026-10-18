CREATE TABLE "accessibility_fix_check_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"check_id" text NOT NULL,
	"url" text NOT NULL,
	"outcome" text NOT NULL,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "accessibility_fix_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"experiment_id" text NOT NULL,
	"rule_id" text NOT NULL,
	"checked_at" text NOT NULL,
	"checked_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accessibility_fix_check_pages" ADD CONSTRAINT "accessibility_fix_check_pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessibility_fix_check_pages" ADD CONSTRAINT "accessibility_fix_check_pages_check_id_accessibility_fix_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."accessibility_fix_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessibility_fix_checks" ADD CONSTRAINT "accessibility_fix_checks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accessibility_fix_checks" ADD CONSTRAINT "accessibility_fix_checks_experiment_id_growth_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."growth_experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accessibility_fix_check_pages_check_idx" ON "accessibility_fix_check_pages" USING btree ("check_id");--> statement-breakpoint
CREATE INDEX "accessibility_fix_checks_experiment_idx" ON "accessibility_fix_checks" USING btree ("project_id","experiment_id");