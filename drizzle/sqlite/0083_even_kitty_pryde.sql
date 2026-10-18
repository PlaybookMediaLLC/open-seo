ALTER TABLE `split_tests` ADD `template_path` text;--> statement-breakpoint
ALTER TABLE `split_tests` ADD `branch` text;--> statement-breakpoint
ALTER TABLE `split_tests` ADD `pull_request_number` integer;--> statement-breakpoint
ALTER TABLE `split_tests` ADD `pull_request_url` text;--> statement-breakpoint
ALTER TABLE `split_tests` ADD `checked_sha` text;--> statement-breakpoint
ALTER TABLE `split_tests` ADD `check_passed` integer;--> statement-breakpoint
ALTER TABLE `split_tests` ADD `check_problems` text;