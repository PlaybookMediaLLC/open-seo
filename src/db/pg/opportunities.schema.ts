import {
  boolean,
  index,
  integer,
  doublePrecision,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";
import { audits } from "./audit.schema";
import {
  BRAND_TERM_AUTHORS,
  EVIDENCE_PERIODS,
  OPPORTUNITY_DECISIONS,
  OPPORTUNITY_DIAGNOSES,
  OPPORTUNITY_RUN_KINDS,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  OPPORTUNITY_URL_ROLES,
} from "@/types/schemas/opportunities";

export const opportunityRuns = pgTable(
  "opportunity_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    siteUrl: text("site_url").notNull(),
    status: text("status", {
      enum: ["running", "completed", "failed"],
    }).notNull(),
    requestedBy: text("requested_by").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    previousStartDate: text("previous_start_date").notNull(),
    previousEndDate: text("previous_end_date").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    queryRows: integer("query_rows").notNull().default(0),
    currentPageRows: integer("current_page_rows").notNull().default(0),
    previousPageRows: integer("previous_page_rows").notNull().default(0),
    requestCount: integer("request_count").notNull().default(0),
    opportunityCount: integer("opportunity_count").notNull().default(0),
    truncated: boolean("truncated").notNull().default(false),
    error: text("error"),
    completionToken: text("completion_token"),
    kind: text("kind", { enum: OPPORTUNITY_RUN_KINDS })
      .notNull()
      .default("search_console"),
    yearAgoPageRows: integer("year_ago_page_rows").notNull().default(0),
    ga4PropertyId: text("ga4_property_id"),
    // RFC-0002 phase 2: the audit used, and URL inspections reserved.
    auditId: text("audit_id").references(() => audits.id, {
      onDelete: "set null",
    }),
    inspectionRequests: integer("inspection_requests").notNull().default(0),
  },
  (t) => [
    index("opportunity_runs_project_started_idx").on(t.projectId, t.startedAt),
  ],
);

export const opportunities = pgTable(
  "opportunities",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    siteUrl: text("site_url").notNull(),
    identityKey: text("identity_key").notNull(),
    type: text("type", { enum: OPPORTUNITY_TYPES }).notNull(),
    url: text("url").notNull(),
    query: text("query"),
    title: text("title").notNull(),
    explanation: text("explanation").notNull(),
    recommendedAction: text("recommended_action").notNull(),
    searchIntent: text("search_intent").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    effortHours: doublePrecision("effort_hours").notNull(),
    priority: integer("priority").notNull(),
    commercialScore: doublePrecision("commercial_score").notNull(),
    demandScore: doublePrecision("demand_score").notNull(),
    visibilityScore: doublePrecision("visibility_score").notNull(),
    difficultyScore: doublePrecision("difficulty_score").notNull(),
    effortScore: doublePrecision("effort_score").notNull(),
    scoreExplanation: text("score_explanation").notNull(),
    uncertainty: text("uncertainty").notNull(),
    status: text("status", { enum: OPPORTUNITY_STATUSES })
      .notNull()
      .default("discovered"),
    ownerUserId: text("owner_user_id"),
    evidenceRunId: text("evidence_run_id")
      .notNull()
      .references(() => opportunityRuns.id, { onDelete: "cascade" }),
    firstDetectedAt: text("first_detected_at").notNull(),
    lastDetectedAt: text("last_detected_at").notNull(),
    deferredUntil: text("deferred_until"),
    version: integer("version").notNull().default(1),
    lastDecisionId: text("last_decision_id"),
    // Set only for declining pages (RFC-0002 5.3).
    diagnosis: text("diagnosis", { enum: OPPORTUNITY_DIAGNOSES }),
  },
  (t) => [
    uniqueIndex("opportunities_project_identity_idx").on(
      t.projectId,
      t.identityKey,
    ),
    index("opportunities_project_status_priority_idx").on(
      t.projectId,
      t.status,
      t.priority,
    ),
  ],
);

export const opportunityEvidence = pgTable(
  "opportunity_evidence",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => opportunityRuns.id, { onDelete: "cascade" }),
    source: text("source", { enum: ["google_search_console"] }).notNull(),
    period: text("period", { enum: EVIDENCE_PERIODS }).notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    clicks: doublePrecision("clicks").notNull(),
    impressions: doublePrecision("impressions").notNull(),
    ctr: doublePrecision("ctr").notNull(),
    position: doublePrecision("position").notNull(),
    // An empty string means the opportunity's own URL or query.
    url: text("url").notNull().default(""),
    query: text("query").notNull().default(""),
  },
  (t) => [
    uniqueIndex("opportunity_evidence_run_period_url_query_idx").on(
      t.opportunityId,
      t.runId,
      t.period,
      t.url,
      t.query,
    ),
    index("opportunity_evidence_project_opportunity_idx").on(
      t.projectId,
      t.opportunityId,
    ),
  ],
);

export const opportunityDecisions = pgTable(
  "opportunity_decisions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    evidenceRunId: text("evidence_run_id")
      .notNull()
      .references(() => opportunityRuns.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").notNull(),
    decision: text("decision", { enum: OPPORTUNITY_DECISIONS }).notNull(),
    fromStatus: text("from_status", { enum: OPPORTUNITY_STATUSES }).notNull(),
    toStatus: text("to_status", { enum: OPPORTUNITY_STATUSES }).notNull(),
    note: text("note").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("opportunity_decisions_project_opportunity_idx").on(
      t.projectId,
      t.opportunityId,
    ),
  ],
);

export const opportunityUrls = pgTable(
  "opportunity_urls",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    role: text("role", { enum: OPPORTUNITY_URL_ROLES }).notNull(),
  },
  (t) => [
    uniqueIndex("opportunity_urls_opportunity_url_role_idx").on(
      t.opportunityId,
      t.url,
      t.role,
    ),
    index("opportunity_urls_project_opportunity_idx").on(
      t.projectId,
      t.opportunityId,
    ),
  ],
);

export const opportunityGa4Evidence = pgTable(
  "opportunity_ga4_evidence",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => opportunityRuns.id, { onDelete: "cascade" }),
    period: text("period", { enum: ["current", "previous"] }).notNull(),
    landingPage: text("landing_page").notNull(),
    sessions: doublePrecision("sessions").notNull(),
    keyEvents: doublePrecision("key_events").notNull(),
    revenue: doublePrecision("revenue"),
    currency: text("currency"),
    // RFC-0012: device rows for the device gap, engagement and form counts.
    device: text("device", { enum: ["all", "mobile", "desktop"] })
      .notNull()
      .default("all"),
    engagedSessions: doublePrecision("engaged_sessions"),
    keyEventName: text("key_event_name"),
    formStarts: doublePrecision("form_starts"),
    formSubmits: doublePrecision("form_submits"),
  },
  (t) => [
    uniqueIndex("opportunity_ga4_evidence_opportunity_run_period_idx").on(
      t.opportunityId,
      t.runId,
      t.period,
      t.device,
    ),
    index("opportunity_ga4_evidence_project_opportunity_idx").on(
      t.projectId,
      t.opportunityId,
    ),
  ],
);

export const projectBrandTerms = pgTable(
  "project_brand_terms",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    createdBy: text("created_by", { enum: BRAND_TERM_AUTHORS }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("project_brand_terms_project_term_idx").on(t.projectId, t.term),
  ],
);

// RFC-0012 5.2: the GA4 key event the owner chose as "the conversion", with
// an optional value per conversion.
export const projectConversionEvents = pgTable("project_conversion_events", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  eventName: text("event_name").notNull(),
  valueMinor: integer("value_minor"),
  currency: text("currency"),
  // RFC-0012 5.3: the organic search channel by default, or all channels.
  channel: text("channel", { enum: ["organic_search", "all"] })
    .notNull()
    .default("organic_search"),
  createdBy: text("created_by").notNull(),
  updatedAt: text("updated_at").notNull(),
});
