CREATE TABLE `github_app_installation_repositories` (
	`installation_ref` text NOT NULL,
	`repository_id` text NOT NULL,
	PRIMARY KEY(`installation_ref`, `repository_id`),
	FOREIGN KEY (`installation_ref`) REFERENCES `github_app_installations`(`id`) ON UPDATE no action ON DELETE cascade
);
