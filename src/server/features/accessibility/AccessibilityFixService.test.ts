import { beforeEach, expect, it, vi } from "vitest";
import {
  makePublishingFixture,
  publishingTestSecret,
} from "@/server/features/publishing/publishing-test-fixtures";
import type { PublishingRepository } from "@/server/features/publishing/repositories/PublishingRepository";
import { AppError } from "@/server/lib/errors";
import type { AccessibilityFixInput } from "@/types/schemas/accessibility";
import { AccessibilityFixService } from "./AccessibilityFixService";

// RFC-0013 5.4: one attribute on one element, prepared for review.
const mocks = vi.hoisted(() => ({
  project: vi.fn(),
  env: vi.fn(),
  claim: vi.fn(),
  finish: vi.fn(),
  connection: vi.fn(),
  detail: vi.fn(),
  gsc: vi.fn(),
  save: vi.fn<typeof PublishingRepository.saveProposal>(),
  client: vi.fn(),
  readFile: vi.fn(),
}));
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: { getProjectForOrganization: mocks.project },
}));
vi.mock("@/server/lib/runtime-env", () => ({ getOptionalEnvValue: mocks.env }));
vi.mock(
  "@/server/features/dashboard/repositories/DataRefreshClaimRepository",
  () => ({
    DataRefreshClaimRepository: { claim: mocks.claim, finish: mocks.finish },
  }),
);
vi.mock(
  "@/server/features/opportunities/repositories/OpportunityRepository",
  () => ({ OpportunityRepository: { getDetail: mocks.detail } }),
);
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: { getConnection: mocks.gsc },
}));
vi.mock(
  "@/server/features/publishing/repositories/PublishingRepository",
  () => ({
    PublishingRepository: {
      getConnection: mocks.connection,
      saveProposal: mocks.save,
    },
  }),
);
vi.mock("@/server/features/publishing/githubClient", () => ({
  createGithubClient: mocks.client,
}));

const LAYOUT =
  'export default function Root({ children }) {\n  return <html lang="en_US"><body>{children}</body></html>;\n}\n';
let fixture: Awaited<ReturnType<typeof makePublishingFixture>>;
let input: AccessibilityFixInput;
const evidence = (ruleId: string) => ({
  id: "evidence-row",
  opportunityId: fixture.detail.opportunity.id,
  runId: fixture.detail.opportunity.evidenceRunId,
  auditId: "audit-1",
  clusterKey: "cluster",
  ruleId,
  impact: "serious" as const,
  wcagTags: "wcag2a",
  pagesAffected: 3,
  exampleUrl: "https://example.com/pricing",
  exampleSelector: "html",
  exampleSnippet: '<html lang="en_US">',
});
beforeEach(async () => {
  fixture = await makePublishingFixture();
  fixture.detail.opportunity.type = "accessibility_issue";
  fixture.detail.accessibilityEvidence = [evidence("html-lang-valid")];
  input = {
    projectId: fixture.connection.projectId,
    opportunityId: fixture.detail.opportunity.id,
    expectedOpportunityVersion: fixture.detail.opportunity.version,
    fix: { kind: "lang", language: "en-US" },
  };
  mocks.project.mockResolvedValue({ id: input.projectId });
  mocks.env.mockResolvedValue(publishingTestSecret);
  mocks.claim.mockResolvedValue("claim-1");
  mocks.finish.mockResolvedValue(undefined);
  mocks.connection.mockResolvedValue(fixture.connection);
  mocks.detail.mockResolvedValue(fixture.detail);
  mocks.gsc.mockResolvedValue({ siteUrl: fixture.detail.opportunity.siteUrl });
  mocks.save.mockResolvedValue(true);
  mocks.readFile.mockImplementation(async (path: string) => {
    if (path !== "app/layout.tsx") throw new AppError("NOT_FOUND");
    return { source: LAYOUT, blobSha: "c".repeat(40) };
  });
  mocks.client.mockReturnValue({
    getRepository: async () => fixture.repository,
    getRef: async () => ({ sha: fixture.proposal.baseSha }),
    readFile: mocks.readFile,
  });
});

it("sets the page language on the root layout's <html> element", async () => {
  expect(
    (await AccessibilityFixService.prepare(fixture.context, input)).ok,
  ).toBe(true);
  const saved = mocks.save.mock.calls[0][0];
  expect(saved.proposal).toMatchObject({
    changeKind: "jsx_attribute",
    filePath: "app/layout.tsx",
  });
  expect(saved.textEdits).toEqual([
    expect.objectContaining({
      nodeKind: "jsx_attribute",
      beforeText: '<html lang="en_US">',
      afterText: '<html lang="en-US">',
    }),
  ]);
});

it('refuses alt text that starts with "image of", before any GitHub read', async () => {
  fixture.detail.accessibilityEvidence = [evidence("image-alt")];
  const result = await AccessibilityFixService.prepare(fixture.context, {
    ...input,
    fix: { kind: "alt", decorative: false, text: "Image of our team" },
  });
  expect(result).toMatchObject({ ok: false });
  expect(result.message).toContain("image of");
  expect(mocks.client).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});
