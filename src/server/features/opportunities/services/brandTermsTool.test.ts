import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getProjectContextTool,
  updateProjectContextTool,
} from "@/server/mcp/tools/project-context";
import {
  makeToolContext,
  textContent,
} from "@/server/mcp/tools/tool-test-support";

// The project context tools carry brand terms through playbook-seam lines.
const mocks = vi.hoisted(() => ({
  getProjectForOrganization: vi.fn(),
  listSections: vi.fn(),
  listCompetitors: vi.fn(),
  listKeyPages: vi.fn(),
  listResearchLog: vi.fn(),
  listTemplates: vi.fn(),
  list: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("@/server/features/projects/services/ProjectService", () => ({
  ProjectService: {
    getProjectForOrganization: mocks.getProjectForOrganization,
  },
}));
vi.mock("@/db/runBatch", () => ({ runBatch: async () => {} }));
vi.mock(
  "@/server/features/project-context/repositories/ProjectContextRepository",
  () => ({ ProjectContextRepository: mocks }),
);
vi.mock(
  "@/server/features/reports/repositories/ReportTemplateRepository",
  () => ({ ReportTemplateRepository: mocks }),
);
vi.mock("../repositories/BrandTermRepository", () => ({
  BrandTermRepository: { list: mocks.list, replace: mocks.replace },
}));

beforeEach(() => {
  mocks.getProjectForOrganization.mockResolvedValue({ id: "project_1" });
  for (const list of [
    mocks.listSections,
    mocks.listCompetitors,
    mocks.listKeyPages,
    mocks.listResearchLog,
    mocks.listTemplates,
  ])
    list.mockResolvedValue([]);
  mocks.list.mockResolvedValue({ terms: [], domain: "acme.com" });
});

describe("brand terms in the project context tools", () => {
  it("reads the domain term until terms are saved", async () => {
    const result = await getProjectContextTool.handler(
      { projectId: "project_1" },
      makeToolContext(),
    );
    expect(result.structuredContent).toMatchObject({
      brandTerms: { terms: ["acme"], source: "domain" },
    });
    expect(textContent(result)).toContain("## Brand terms");
  });

  it("saves only brand terms, as MCP, when a call sends no updates", async () => {
    mocks.list.mockResolvedValue({ terms: ["acme"], domain: "acme.com" });
    const result = await updateProjectContextTool.handler(
      { projectId: "project_1", brandTerms: ["acme"] },
      makeToolContext(),
    );
    expect(mocks.replace).toHaveBeenCalledWith("project_1", ["acme"], "mcp");
    expect(result.structuredContent).toMatchObject({
      brandTerms: { terms: ["acme"], source: "saved" },
    });
  });
});
