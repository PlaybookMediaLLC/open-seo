import { readFileSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
import {
  makePublishingFixture,
  publishingTestSecret,
} from "@/server/features/publishing/publishing-test-fixtures";
import type { PublishingRepository } from "@/server/features/publishing/repositories/PublishingRepository";
import { AppError } from "@/server/lib/errors";
import type { PerformanceFixInput } from "@/types/schemas/performance";
import { PerformanceFixService } from "./PerformanceFixService";

// RFC-0014 5.5: one attribute change on one element, for each cause.
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
  items: vi.fn(),
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
vi.mock("@/server/features/publishing/fileLocator", () => ({
  locateMetadataFile: async () => ({
    status: "found",
    filePath: "app/blog/page.tsx",
  }),
}));
vi.mock("./performanceSignals", () => ({ reportItems: mocks.items }));

const PNG = new Uint8Array(
  readFileSync("src/server/features/performance/fixtures/hero.png"),
);
let fixture: Awaited<ReturnType<typeof makePublishingFixture>>;
let files: Record<string, string>;
const prepare = (fix: PerformanceFixInput["fix"], causeIds: string) => {
  fixture.detail.performanceEvidence = [
    {
      id: "row",
      opportunityId: fixture.detail.opportunity.id,
      runId: fixture.detail.opportunity.evidenceRunId,
      template: "/blog",
      metric: "lcp",
      formFactor: "phone",
      p75Value: 3_100,
      threshold: 2_500,
      scope: "url",
      target: "https://example.com/blog",
      collectionEnd: "2026-10-17",
      labValue: null,
      causeIds,
    },
  ];
  return PerformanceFixService.prepare(fixture.context, {
    projectId: fixture.connection.projectId,
    opportunityId: fixture.detail.opportunity.id,
    expectedOpportunityVersion: fixture.detail.opportunity.version,
    fix,
  });
};
const afterText = () => mocks.save.mock.calls[0][0].textEdits?.[0].afterText;

beforeEach(async () => {
  fixture = await makePublishingFixture();
  fixture.detail.opportunity.type = "performance_issue";
  files = { "package.json": '{"dependencies":{"next":"^15.4.0"}}' };
  mocks.project.mockResolvedValue({ id: fixture.connection.projectId });
  mocks.env.mockResolvedValue(publishingTestSecret);
  mocks.claim.mockResolvedValue("claim-1");
  mocks.finish.mockResolvedValue(undefined);
  mocks.connection.mockResolvedValue(fixture.connection);
  mocks.detail.mockResolvedValue(fixture.detail);
  mocks.gsc.mockResolvedValue({ siteUrl: fixture.detail.opportunity.siteUrl });
  mocks.save.mockResolvedValue(true);
  mocks.items.mockResolvedValue(new Map());
  mocks.client.mockReturnValue({
    getRepository: async () => fixture.repository,
    getRef: async () => ({ sha: fixture.proposal.baseSha }),
    readFile: async (path: string) => {
      if (!(path in files)) throw new AppError("NOT_FOUND");
      return { source: files[path], blobSha: "c".repeat(40) };
    },
    readFileHead: async () => PNG,
  });
});

it("gives the LCP image the priority prop of the installed Next.js", async () => {
  files["app/blog/page.tsx"] =
    'import Image from "next/image";\nimport hero from "./hero.png";\nexport default () => <Image src={hero} loading="lazy" alt="" />;\n';
  mocks.items.mockResolvedValue(
    new Map([
      [
        "prioritize-lcp-image",
        [{ url: "https://example.com/_next/static/media/hero.0a1b2c3d.png" }],
      ],
    ]),
  );
  expect((await prepare("lcp_priority", "lcp_lazy_image")).ok).toBe(true);
  expect(afterText()).toBe('<Image src={hero} alt="" priority />');
});

it("adds the width and height read from the image file", async () => {
  files["app/blog/page.tsx"] =
    'export default () => <img src="/images/team.png" alt="Team" />;\n';
  mocks.items.mockResolvedValue(
    new Map([
      ["unsized-images", [{ url: "https://example.com/images/team.png" }]],
    ]),
  );
  expect((await prepare("image_size", "unsized_images")).ok).toBe(true);
  expect(afterText()).toBe(
    '<img src="/images/team.png" alt="Team" width="37" height="23" />',
  );
});

it("loads only listed script hosts later, and refuses others", async () => {
  files["app/blog/page.tsx"] = "export default () => <main />;\n";
  files["app/layout.tsx"] =
    'import Script from "next/script";\nexport default ({ children }) => (<html><body>{children}<Script src="https://www.googletagmanager.com/gtag/js?id=G-1" /><Script src="https://cdn.example.com/app.js" /></body></html>);\n';
  expect((await prepare("script_strategy", "third_party_scripts")).ok).toBe(
    true,
  );
  expect(afterText()).toBe(
    '<Script src="https://www.googletagmanager.com/gtag/js?id=G-1" strategy="lazyOnload" />',
  );
  expect(mocks.save.mock.calls[0][0].proposal.risk).toContain(
    "The root layout renders on every page",
  );
  files["app/layout.tsx"] =
    'import Script from "next/script";\nexport default ({ children }) => (<html><body>{children}<Script src="https://cdn.example.com/app.js" /></body></html>);\n';
  const refused = await prepare("script_strategy", "third_party_scripts");
  expect(refused).toMatchObject({ ok: false });
  expect(refused.message).toContain("listed host");
});
