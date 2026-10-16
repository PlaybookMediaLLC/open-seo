import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { projects } from "./app.schema";
import { opportunities, opportunityRuns } from "./opportunities.schema";

export const publishingConnections = sqliteTable(
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

export const opportunityProposals = sqliteTable(
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
    fingerprintVersion: integer("fingerprint_version").notNull().default(1),
    adapterId: text("adapter_id", {
      enum: ["app_router_metadata", "pages_router_head"],
    })
      .notNull()
      .default("app_router_metadata"),
    // A revert proposal points at the proposal whose change it undoes.
    revertsProposalId: text("reverts_proposal_id").references(
      (): AnySQLiteColumn => opportunityProposals.id,
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

export const proposalApprovals = sqliteTable(
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

export const proposalExecutions = sqliteTable(
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

export const proposalExecutionEvents = sqliteTable(
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
