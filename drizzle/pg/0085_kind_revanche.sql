CREATE TABLE "github_app_installation_repositories" (
	"installation_ref" text NOT NULL,
	"repository_id" text NOT NULL,
	CONSTRAINT "github_app_installation_repositories_installation_ref_repository_id_pk" PRIMARY KEY("installation_ref","repository_id")
);
--> statement-breakpoint
ALTER TABLE "github_app_installation_repositories" ADD CONSTRAINT "github_app_installation_repositories_installation_ref_github_app_installations_id_fk" FOREIGN KEY ("installation_ref") REFERENCES "public"."github_app_installations"("id") ON DELETE cascade ON UPDATE no action;