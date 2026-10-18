ALTER TABLE "split_tests" ADD COLUMN "template_path" text;--> statement-breakpoint
ALTER TABLE "split_tests" ADD COLUMN "branch" text;--> statement-breakpoint
ALTER TABLE "split_tests" ADD COLUMN "pull_request_number" integer;--> statement-breakpoint
ALTER TABLE "split_tests" ADD COLUMN "pull_request_url" text;--> statement-breakpoint
ALTER TABLE "split_tests" ADD COLUMN "checked_sha" text;--> statement-breakpoint
ALTER TABLE "split_tests" ADD COLUMN "check_passed" boolean;--> statement-breakpoint
ALTER TABLE "split_tests" ADD COLUMN "check_problems" text;