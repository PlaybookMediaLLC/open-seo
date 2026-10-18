import { beforeEach, expect, it, vi } from "vitest";
import { GithubAppService } from "./GithubAppService";

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  exchange: vi.fn(),
  installations: vi.fn(),
  save: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("./githubAppState", () => ({
  consumeAppState: mocks.consume,
  createAppState: vi.fn(),
}));
vi.mock("./githubApp", () => ({
  exchangeUserCode: mocks.exchange,
  userInstallations: mocks.installations,
  githubAppConfig: vi.fn(),
  installationRepositories: vi.fn(),
  installationToken: vi.fn(),
}));
vi.mock("./repositories/PublishingRepository", () => ({
  PublishingRepository: { saveInstallation: mocks.save },
}));

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
  mocks.exchange.mockResolvedValue("user-token");
  mocks.installations.mockResolvedValue([
    { id: 7, account: { login: "PlaybookMediaLLC", type: "Organization" } },
  ]);
});

it("records an installation that the GitHub user can access", async () => {
  const response = await setup(7);
  expect(response.headers.get("location")).toContain("githubApp=installed");
  expect(mocks.save).toHaveBeenCalledWith(
    expect.objectContaining({ organizationId: "org-1", installationId: 7 }),
    expect.objectContaining({ action: "github_app.installed" }),
  );
});

it("refuses a forged installation_id that the user cannot access", async () => {
  const response = await setup(999);
  expect(response.headers.get("location")).toContain("githubApp=refused");
  expect(mocks.save).not.toHaveBeenCalled();
});
