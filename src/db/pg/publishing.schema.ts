import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";
import { organization } from "./better-auth-schema";
import { opportunities, opportunityRuns } from "./opportunities.schema";

export const publishingConnections = pgTable(
  "publishing_connections",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    repositoryId: text("repository_id").notNull(),
    owner: text("owner").notNull(),
    repository: text("repository").notNull(),
    baseBranch: text("base_branch").notNull(),
    rootDirectory: text("root_directory").notNull(),
    productionEnvironment: text("production_environment")
      .notNull()
      .default("Production"),
    // "github_app" connections mint a short-lived installation token per
    // operation and store no token (RFC-0005 5.7).
    transport: text("transport", { enum: ["pat", "github_app"] })
      .notNull()
      .default("pat"),
    installationRef: text("installation_ref").references(
      () => githubAppInstallations.id,
      { onDelete: "set null" },
    ),
    encryptedToken: text("encrypted_token"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    revokedAt: text("revoked_at"),
    lastEventId: text("last_event_id"),
  },
  (t) => [
    uniqueIndex("publishing_connections_active_project_idx")
      .on(t.projectId)
      .where(sql`${t.revokedAt} is null`),
  ],
);

export const opportunityProposals = pgTable(
  "opportunity_proposals",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    connectionId: text("connection_id")
      .notNull()
      .references(() => publishingConnections.id, { onDelete: "cascade" }),
    evidenceRunId: text("evidence_run_id")
      .notNull()
      .references(() => opportunityRuns.id, { onDelete: "cascade" }),
    opportunityVersion: integer("opportunity_version").notNull(),
    targetUrl: text("target_url").notNull(),
    filePath: text("file_path").notNull(),
    baseSha: text("base_sha").notNull(),
    beforeBlobSha: text("before_blob_sha").notNull(),
    afterBlobSha: text("after_blob_sha").notNull(),
    descriptionBefore: text("description_before").notNull(),
    descriptionAfter: text("description_after").notNull(),
    beforeSnippet: text("before_snippet").notNull(),
    afterSnippet: text("after_snippet").notNull(),
    metadataSource: text("metadata_source", {
      enum: ["literal_object", "helper_call"],
    })
      .notNull()
      .default("literal_object"),
    helperPath: text("helper_path"),
    helperBlobSha: text("helper_blob_sha"),
    titleBefore: text("title_before"),
    titleAfter: text("title_after"),
    titleBeforeSnippet: text("title_before_snippet"),
    titleAfterSnippet: text("title_after_snippet"),
    canonicalBefore: text("canonical_before"),
    canonicalAfter: text("canonical_after"),
    canonicalBeforeSnippet: text("canonical_before_snippet"),
    canonicalAfterSnippet: text("canonical_after_snippet"),
    robotsBefore: text("robots_before"),
    robotsAfter: text("robots_after"),
    robotsBeforeSnippet: text("robots_before_snippet"),
    robotsAfterSnippet: text("robots_after_snippet"),
    fingerprintVersion: integer("fingerprint_version").notNull().default(1),
    adapterId: text("adapter_id", {
      enum: ["app_router_metadata", "pages_router_head"],
    })
      .notNull()
      .default("app_router_metadata"),
    // A revert proposal points at the proposal whose change it undoes.
    revertsProposalId: text("reverts_proposal_id").references(
      (): AnyPgColumn => opportunityProposals.id,
      { onDelete: "set null" },
    ),
    changeHash: text("change_hash").notNull(),
    reason: text("reason").notNull(),
    expectedEffect: text("expected_effect").notNull(),
    risk: text("risk").notNull(),
    verificationPlan: text("verification_plan").notNull(),
    validationSummary: text("validation_summary").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("opportunity_proposals_project_opportunity_idx").on(
      t.projectId,
      t.opportunityId,
      t.createdAt,
    ),
  ],
);

export const proposalApprovals = pgTable(
  "proposal_approvals",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => opportunityProposals.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").notNull(),
    changeHash: text("change_hash").notNull(),
    note: text("note").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("proposal_approvals_project_proposal_idx").on(
      t.projectId,
      t.proposalId,
    ),
  ],
);

export const proposalExecutions = pgTable(
  "proposal_executions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => opportunityProposals.id, { onDelete: "cascade" }),
    approvalId: text("approval_id")
      .notNull()
      .references(() => proposalApprovals.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["running", "succeeded", "failed"],
    }).notNull(),
    phase: text("phase", {
      enum: [
        "validating",
        "branch_created",
        "file_committed",
        "pull_request_created",
        "failed",
      ],
    }).notNull(),
    branchName: text("branch_name").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    requestCount: integer("request_count").notNull(),
    commitSha: text("commit_sha"),
    pullRequestNumber: integer("pull_request_number"),
    pullRequestUrl: text("pull_request_url"),
    error: text("error"),
    lastEventId: text("last_event_id"),
  },
  (t) => [
    index("proposal_executions_project_proposal_idx").on(
      t.projectId,
      t.proposalId,
      t.startedAt,
    ),
  ],
);

export const proposalExecutionEvents = pgTable(
  "proposal_execution_events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    executionId: text("execution_id")
      .notNull()
      .references(() => proposalExecutions.id, { onDelete: "cascade" }),
    phase: text("phase", {
      enum: [
        "validating",
        "branch_created",
        "file_committed",
        "pull_request_created",
        "failed",
      ],
    }).notNull(),
    message: text("message").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("proposal_execution_events_project_execution_idx").on(
      t.projectId,
      t.executionId,
      t.createdAt,
    ),
  ],
);

// GitHub issues created from an approved ticket text (RFC-0005 5.10). The
// unique text hash per opportunity makes one approval create one issue.
export const opportunityTickets = pgTable(
  "opportunity_tickets",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    connectionId: text("connection_id")
      .notNull()
      .references(() => publishingConnections.id, { onDelete: "cascade" }),
    textHash: text("text_hash").notNull(),
    issueNumber: integer("issue_number"),
    issueUrl: text("issue_url"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("opportunity_tickets_text_idx").on(t.opportunityId, t.textHash),
  ],
);

// GitHub App installations that a person in the organization proved they can
// access, through the user-token check in the setup callback.
export const githubAppInstallations = pgTable(
  "github_app_installations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    installationId: integer("installation_id").notNull(),
    accountLogin: text("account_login").notNull(),
    accountType: text("account_type").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (t) => [
    uniqueIndex("github_app_installations_org_idx").on(
      t.organizationId,
      t.installationId,
    ),
  ],
);
