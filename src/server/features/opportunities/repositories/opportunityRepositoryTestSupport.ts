import { expect } from "vitest";
import { opportunityRun } from "../services/opportunityTestFixtures";
import {
  listOpportunitiesInputSchema,
  type OpportunityCandidate,
  type OpportunityRun,
} from "@/types/schemas/opportunities";
import { OpportunityRepository as repo } from "./OpportunityRepository";
import type { createOpportunityTestDatabase } from "./opportunityRepositoryTestDb";

// Shared by the real-SQL repository test files. Each test file mocks the
// database first, so the repository here runs against the test database.
type TestClient = ReturnType<typeof createOpportunityTestDatabase>["client"];

export function candidate(
  overrides: Partial<OpportunityCandidate & { identityKey: string }> = {},
) {
  return {
    identityKey: "page-query",
    type: "striking_distance",
    url: "https://example.com/page",
    query: "widgets",
    title: "Improve widgets page",
    explanation: "Ranks near page one",
    recommendedAction: "Review the page",
    searchIntent: "commercial",
    confidence: 0.8,
    effortHours: 2,
    priority: 70,
    commercialScore: 70,
    demandScore: 80,
    visibilityScore: 60,
    difficultyScore: 50,
    effortScore: 90,
    scoreExplanation: "High impressions",
    uncertainty: "No conversion data",
    diagnosis: null,
    evidence: [
      {
        period: "current",
        url: "",
        query: "",
        metrics: { clicks: 20, impressions: 1000, ctr: 0.02, position: 12 },
      },
      {
        period: "previous",
        url: "",
        query: "",
        metrics: { clicks: 10, impressions: 900, ctr: 0.011, position: 14 },
      },
    ],
    urls: [],
    ga4: [],
    ...overrides,
  } satisfies OpportunityCandidate & { identityKey: string };
}

/** The slug prefix must match the file's database cleanup prefix. */
export async function setupRun(
  client: TestClient,
  slugPrefix = "opportunity-test-",
): Promise<{ run: OpportunityRun; claimKey: string }> {
  const projectId = crypto.randomUUID();
  await client.execute({
    sql: "INSERT INTO organization (id, name, slug, created_at) VALUES (?, 'test', ?, CURRENT_TIMESTAMP)",
    args: [projectId, `${slugPrefix}${projectId}`],
  });
  await client.execute({
    sql: "INSERT INTO projects (id, organization_id, name) VALUES (?, ?, 'test')",
    args: [projectId, projectId],
  });
  const run = opportunityRun({
    id: crypto.randomUUID(),
    projectId,
    siteUrl: "sc-domain:example.com",
    status: "running",
    finishedAt: null,
  });
  const claimKey = `opportunities:${projectId}`;
  await client.execute({
    sql: "INSERT INTO gsc_connections (id, project_id, site_url, organization_id, connected_by_user_id) VALUES (?, ?, ?, ?, 'test')",
    args: [projectId, projectId, run.siteUrl, projectId],
  });
  await client.execute({
    sql: "INSERT INTO data_refresh_claims VALUES (?, ?, ?, ?)",
    args: [claimKey, projectId, run.id, Date.now() + 180_000],
  });
  await repo.startRun(run);
  return { run, claimKey };
}

export async function finishRun(
  input: Awaited<ReturnType<typeof setupRun>>,
  candidates = [candidate()],
) {
  expect(await repo.completeRun({ ...input, candidates })).toBe(true);
  return (
    await repo.list(
      listOpportunitiesInputSchema.parse({ projectId: input.run.projectId }),
    )
  ).rows[0];
}

export function pairCandidate(
  primary = "https://example.com/a",
  competing = "https://example.com/b",
) {
  const metrics = { clicks: 5, impressions: 300, ctr: 0.0167, position: 6 };
  return candidate({
    identityKey: "pair",
    type: "cannibalization",
    url: primary,
    query: null,
    evidence: [
      { period: "current", url: "", query: "", metrics },
      { period: "current", url: primary, query: "widgets", metrics },
      { period: "current", url: competing, query: "widgets", metrics },
    ],
    urls: [
      { url: primary, role: "primary" },
      { url: competing, role: "competing" },
    ],
    ga4: [
      {
        period: "current",
        landingPage: "/a",
        sessions: 40,
        keyEvents: 3,
        revenue: null,
        currency: "USD",
        device: "all",
        engagedSessions: null,
        keyEventName: null,
        formStarts: null,
        formSubmits: null,
      },
    ],
  });
}

/** RFC-0009: the audit event that review() writes with its decision. */
export const reviewAudit = {
  organizationId: "test-organization",
  projectId: null,
  actor: { userId: "test" },
  action: "opportunity.reviewed",
  targetType: "opportunity",
  targetId: "test",
  summary: "Reviewed in a test",
} as const;
