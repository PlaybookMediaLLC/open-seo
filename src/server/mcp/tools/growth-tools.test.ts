import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { expect, it, vi } from "vitest";
import { createWorkersOAuthMcpProps } from "../context";
import { createOpenSeoMcpServer } from "../server";
import { draftOpportunityDescriptionTool } from "./growth-tools";
import { makeToolContext } from "./tool-test-support";

const mocks = vi.hoisted(() => ({
  project: vi.fn(async () => ({ id: "project_1" })),
}));
vi.mock("cloudflare:workers", () => ({
  env: {},
  waitUntil: vi.fn(),
  DurableObject: class {
    readonly ctx = null;
  },
}));
// Both project gates pass, so only the role can refuse the draft.
vi.mock("@/server/features/projects/services/ProjectService", () => ({
  ProjectService: { getProjectForOrganization: mocks.project },
}));
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: { getProjectForOrganization: mocks.project },
}));

it("gives agents the growth tools but no way to approve, publish, merge, deploy or revert", async () => {
  const server = createOpenSeoMcpServer(
    createWorkersOAuthMcpProps({
      userId: "user_test",
      userEmail: "test@example.com",
      organizationId: "org_test",
      baseUrl: "https://open-seo.test",
      clientId: "client_test",
      scopes: ["mcp"],
    }),
  );
  const client = new Client({ name: "growth-tools", version: "1" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const { tools } = await client.listTools();
  await client.close();
  const names = tools.map((tool) => tool.name);
  expect(names).toEqual(
    expect.arrayContaining([
      "list_opportunities",
      "get_opportunity",
      "draft_opportunity_description",
      "get_opportunity_ticket",
      "get_experiment_results",
    ]),
  );
  expect(
    names.filter((name) =>
      /approve|execute|publish|merge|deploy|revert|pull_request/.test(name),
    ),
  ).toEqual([]);
  // The draft is the only growth tool that writes, and it writes a draft row.
  expect(
    tools
      .filter((tool) => /opportunit|experiment/.test(tool.name))
      .filter((tool) => !tool.annotations?.readOnlyHint)
      .map((tool) => [tool.name, tool.annotations?.destructiveHint]),
  ).toEqual([["draft_opportunity_description", false]]);
});

it("refuses a draft from a member who cannot manage integrations", async () => {
  await expect(
    draftOpportunityDescriptionTool.handler(
      {
        projectId: "project_1",
        opportunityId: "opportunity_1",
        expectedOpportunityVersion: 1,
      },
      makeToolContext({ role: "member" }),
    ),
  ).rejects.toThrow("Your organization role does not allow this action.");
});
