import { beforeEach, expect, it, vi } from "vitest";
import { GithubAppService } from "./GithubAppService";

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  session: vi.fn(),
  exchange: vi.fn(),
  installations: vi.fn(),
  userRepositories: vi.fn(),
  appRepositories: vi.fn(),
  token: vi.fn(),
  save: vi.fn(),
  installation: vi.fn(),
  allowed: vi.fn(),
  project: vi.fn(),
  claim: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/middleware/ensure-user/resolve", () => ({
  resolveUserContextFromHeaders: mocks.session,
}));
vi.mock("./githubAppState", () => ({
  consumeAppState: mocks.consume,
  createAppState: vi.fn(),
}));
vi.mock("./githubApp", () => ({
  exchangeUserCode: mocks.exchange,
  userInstallations: mocks.installations,
  userInstallationRepositoryIds: mocks.userRepositories,
  githubAppConfig: vi.fn(),
  installationRepositories: mocks.appRepositories,
  installationToken: mocks.token,
}));
vi.mock("./repositories/PublishingRepository", () => ({
  PublishingRepository: {
    saveInstallation: mocks.save,
    getInstallation: mocks.installation,
    listInstallationRepositoryIds: mocks.allowed,
  },
}));
vi.mock("@/server/features/projects/repositories/ProjectRepository", () => ({
  ProjectRepository: { getProjectForOrganization: mocks.project },
}));
vi.mock(
  "@/server/features/dashboard/repositories/DataRefreshClaimRepository",
  () => ({
    DataRefreshClaimRepository: { claim: mocks.claim, finish: vi.fn() },
  }),
);

const owner = { userId: "user-1", organizationId: "org-1", role: "owner" };
const setup = (installationId: number) =>
  GithubAppService.handleSetup(
    new Request(
      `https://relay.example/api/github/app/setup?installation_id=${installationId}&code=c&state=s&setup_action=install`,
    ),
  );

beforeEach(() => {
  mocks.consume.mockResolvedValue({
    userId: "user-1",
    organizationId: "org-1",
    projectId: "project-1",
  });
  mocks.session.mockResolvedValue(owner);
  mocks.exchange.mockResolvedValue("user-token");
  mocks.installations.mockResolvedValue([
    { id: 7, account: { login: "PlaybookMediaLLC", type: "Organization" } },
  ]);
  mocks.userRepositories.mockResolvedValue(["101"]);
  mocks.project.mockResolvedValue({ id: "project-1" });
  mocks.claim.mockResolvedValue("claim");
});

it("records an installation and the repositories the GitHub user can access", async () => {
  const response = await setup(7);
  expect(response.headers.get("location")).toContain("githubApp=installed");
  expect(mocks.userRepositories).toHaveBeenCalledWith("user-token", 7);
  expect(mocks.save).toHaveBeenCalledWith(
    expect.objectContaining({ organizationId: "org-1", installationId: 7 }),
    ["101"],
    expect.objectContaining({ action: "github_app.installed" }),
  );
});

it("refuses a forged installation_id that the user cannot access", async () => {
  const response = await setup(999);
  expect(response.headers.get("location")).toContain("githubApp=refused");
  expect(mocks.save).not.toHaveBeenCalled();
});

it.each([
  ["another signed-in user", { userId: "user-2" }],
  ["a user no longer in the state's organization", { organizationId: "org-2" }],
  ["a member who cannot manage integrations", { role: "member" }],
])("refuses a setup completed by %s", async (_, session) => {
  mocks.session.mockResolvedValue({ ...owner, ...session });
  const response = await setup(7);
  expect(response.headers.get("location")).toContain("githubApp=refused");
  expect(mocks.exchange).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});

it("refuses to connect a repository the linking user could not access", async () => {
  mocks.installation.mockResolvedValue({
    id: "installation-1",
    organizationId: "org-1",
    installationId: 7,
    revokedAt: null,
  });
  mocks.appRepositories.mockResolvedValue([{ id: "101" }, { id: "202" }]);
  mocks.allowed.mockResolvedValue(["101"]);
  const result = await GithubAppService.connect(owner, {
    projectId: "project-1",
    installationRef: "installation-1",
    repositoryId: "202",
    baseBranch: "main",
    rootDirectory: "",
  });
  expect(result.ok).toBe(false);
  expect(mocks.allowed).toHaveBeenCalledWith("installation-1");
  expect(mocks.token).not.toHaveBeenCalled();
});
