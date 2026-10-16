import { vi } from "vitest";
import type { GscService } from "@/server/features/gsc/services/GscService";
import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";
import type { OpportunityRepository } from "../repositories/OpportunityRepository";
import { opportunityDetail } from "./opportunityTestFixtures";

// Shared by the OpportunityService test files. Each file still declares its
// own vi.mock calls, because Vitest hoists them per file.
type Performance = (
  ...args: Parameters<typeof GscService.getPerformance>
) => Promise<{ siteUrl: string; rows: GscSearchAnalyticsRow[] }>;

export const context = {
  organizationId: "org-1",
  userId: "user-1",
  role: "owner",
};
export const projectId = "project-1";
export const siteUrl = "https://example.com/";
export const response = (rows: GscSearchAnalyticsRow[] = []) => ({
  siteUrl,
  rows,
});

export function createServiceMocks() {
  return {
    project: vi.fn(),
    connection: vi.fn(),
    performance: vi.fn<Performance>(),
    keyPages: vi.fn(),
    claim: vi.fn(),
    finish: vi.fn(),
    list: vi.fn(),
    latestRun: vi.fn(),
    listRuns: vi.fn(),
    detail: vi.fn(),
    startRun: vi.fn(),
    setRequestCount: vi.fn(),
    completeRun: vi.fn<typeof OpportunityRepository.completeRun>(),
    failRun: vi.fn(),
    review: vi.fn<typeof OpportunityRepository.review>(),
    difficulty: vi.fn(),
    brandTerms: vi.fn(),
    ga4Connection: vi.fn(),
    ga4Rows: vi.fn(),
    latestAudit: vi.fn(),
    rankHistory: vi.fn(),
    inspectionsToday: vi.fn(),
    inspect: vi.fn(),
    aiCitations: vi.fn(),
    serpChecks: vi.fn(),
  };
}

export function setServiceMockDefaults(
  mocks: ReturnType<typeof createServiceMocks>,
) {
  mocks.project.mockResolvedValue({
    id: projectId,
    locationCode: 2840,
    languageCode: "en",
  });
  mocks.difficulty.mockResolvedValue(new Map());
  mocks.brandTerms.mockResolvedValue({ terms: [], source: "none" });
  mocks.ga4Connection.mockResolvedValue(null);
  mocks.ga4Rows.mockResolvedValue([]);
  mocks.latestAudit.mockResolvedValue(null);
  mocks.rankHistory.mockResolvedValue(new Map());
  mocks.inspectionsToday.mockResolvedValue(0);
  mocks.inspect.mockResolvedValue({ results: [] });
  mocks.aiCitations.mockResolvedValue(null);
  mocks.serpChecks.mockResolvedValue(new Map());
  mocks.connection.mockResolvedValue({ siteUrl });
  mocks.performance.mockResolvedValue(response());
  mocks.keyPages.mockResolvedValue([]);
  mocks.claim.mockResolvedValue("run-1");
  mocks.finish.mockResolvedValue(undefined);
  mocks.list.mockResolvedValue({ rows: [], total: 0 });
  mocks.latestRun.mockResolvedValue(null);
  mocks.listRuns.mockResolvedValue([]);
  mocks.detail.mockResolvedValue(opportunityDetail());
  mocks.startRun.mockResolvedValue(undefined);
  mocks.setRequestCount.mockResolvedValue(undefined);
  mocks.completeRun.mockResolvedValue(true);
  mocks.failRun.mockResolvedValue(undefined);
  mocks.review.mockResolvedValue(true);
}
