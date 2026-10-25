import { readFileSync } from "node:fs";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  listSearchConsoleSitesTool,
  setGoogleAnalyticsPropertyTool,
  setSearchConsoleSiteTool,
} from "./google-connection-tools";
import { makeToolContext } from "./tool-test-support";
import type { ToolContext } from "@/server/mcp/context";

const database = await vi.hoisted(async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const client = createClient({ url: "file::memory:" });
  return { client, db: drizzle(client) };
});
vi.mock("@/db", () => ({ db: database.db }));

beforeAll(() =>
  database.client.executeMultiple(
    readFileSync("drizzle/sqlite/0078_unknown_hammerhead.sql", "utf8"),
  ),
);
afterEach(() => database.client.execute("DELETE FROM audit_events"));
afterAll(() => database.client.close());

const mocks = vi.hoisted(() => ({
  getProjectForOrganization: vi.fn(),
  getProjectWithOrganization: vi.fn(),
  getMembership: vi.fn(),
  GscService: {
    listSitesForUserWithGrantStatus: vi.fn(),
    getConnection: vi.fn(),
    setSite: vi.fn(),
  },
  Ga4Service: { setProperty: vi.fn() },
}));

vi.mock("cloudflare:workers", () => ({
  env: {},
  waitUntil: (promise: Promise<unknown>) => promise,
}));
vi.mock("@/server/lib/posthog", () => ({ captureServerEvent: vi.fn() }));
vi.mock("@/server/email/onboarding-drip", () => ({
  markOnboardingMilestone: vi.fn(),
}));
vi.mock("@/server/features/projects/services/ProjectService", () => ({
  ProjectService: {
    getProjectForOrganization: mocks.getProjectForOrganization,
    getProjectWithOrganization: mocks.getProjectWithOrganization,
  },
}));
vi.mock("@/server/auth/repositories/AuthRepository", () => ({
  AuthRepository: { getMembership: mocks.getMembership },
}));
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: mocks.GscService,
}));
vi.mock("@/server/features/ga4/services/Ga4Service", () => ({
  Ga4Service: mocks.Ga4Service,
}));

const toolContext = makeToolContext();

const gscAccount = (accountId: string) => ({
  accountId,
  email: null,
  requiresReconnect: false,
  propertiesUnavailable: false,
  apiDisabled: false,
  sites: [{ siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" }],
});

const setSiteArgs = {
  projectId: "project_1",
  siteUrl: "sc-domain:example.com",
  gscAccountId: "acct_b",
};

const setters = [
  {
    provider: "Search Console",
    action: "integration.gsc_connected",
    set: mocks.GscService.setSite,
    call: (context: ToolContext) =>
      setSearchConsoleSiteTool.handler(setSiteArgs, context),
  },
  {
    provider: "Google Analytics",
    action: "integration.ga4_connected",
    set: mocks.Ga4Service.setProperty,
    call: (context: ToolContext) =>
      setGoogleAnalyticsPropertyTool.handler(
        {
          projectId: "project_1",
          propertyId: "properties/123",
          ga4AccountId: "acct_b",
        },
        context,
      ),
  },
];

describe("Google connection MCP tools", () => {
  beforeEach(() => {
    mocks.getProjectForOrganization.mockResolvedValue({ id: "project_1" });
    mocks.getProjectWithOrganization.mockResolvedValue({
      project: { id: "project_1" },
      organizationId: "project_org",
    });
    mocks.getMembership.mockResolvedValue({ role: "owner" });
    mocks.GscService.listSitesForUserWithGrantStatus.mockResolvedValue({
      accounts: [gscAccount("acct_a"), gscAccount("acct_b")],
    });
    mocks.GscService.setSite.mockResolvedValue({
      siteUrl: "sc-domain:example.com",
      connectedAccountEmail: null,
    });
    mocks.Ga4Service.setProperty.mockResolvedValue({
      propertyId: "properties/123",
      propertyDisplayName: null,
      connectedAccountEmail: null,
    });
  });

  it("flags only the site bound to the project, on the bound account", async () => {
    mocks.GscService.getConnection.mockResolvedValue({
      siteUrl: "sc-domain:example.com",
      gscAccountId: "acct_b",
    });

    const result = await listSearchConsoleSitesTool.handler(
      { projectId: "project_1" },
      toolContext,
    );

    expect(
      result.structuredContent.accounts.map(
        (account) => account.sites[0]?.isSelected,
      ),
    ).toEqual([false, true]);
  });

  it("binds the project through the requested Google account", async () => {
    const result = await setSearchConsoleSiteTool.handler(
      setSiteArgs,
      toolContext,
    );

    expect(mocks.GscService.setSite).toHaveBeenCalledWith({
      projectId: "project_1",
      organizationId: "org_123",
      siteUrl: "sc-domain:example.com",
      accountId: "acct_b",
      userId: "user_123",
    });
    expect(result.structuredContent).toMatchObject({
      ok: true,
      gscAccountId: "acct_b",
    });
  });

  it.each(setters)(
    "records a $provider change under the verified project organization and MCP actor",
    async ({ call, action }) => {
      await call(makeToolContext({ orgScope: "user" }));

      const { rows } = await database.client.execute(
        "SELECT organization_id, project_id, actor_type, actor_id, action, target_type, target_id FROM audit_events",
      );
      expect(rows).toEqual([
        {
          organization_id: "project_org",
          project_id: "project_1",
          actor_type: "mcp",
          actor_id: "user_123",
          action,
          target_type: "project",
          target_id: "project_1",
        },
      ]);
    },
  );

  it.each(setters)(
    "does not audit a failed $provider change",
    async ({ call, set }) => {
      set.mockRejectedValueOnce(new Error("Property verification failed"));

      await expect(call(toolContext)).rejects.toThrow(
        "Property verification failed",
      );
      expect(
        (await database.client.execute("SELECT id FROM audit_events")).rows,
      ).toEqual([]);
    },
  );

  it.each(setters)(
    "rejects a member-role $provider caller before changing or auditing the connection",
    async ({ call, set }) => {
      await expect(
        call(makeToolContext({ role: "member" })),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(set).not.toHaveBeenCalled();
      expect(
        (await database.client.execute("SELECT id FROM audit_events")).rows,
      ).toEqual([]);
    },
  );
});
