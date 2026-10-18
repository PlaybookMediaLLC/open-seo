import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@/server/lib/errors";
import type { PublishingConnectionRecord } from "@/types/schemas/publishing";
import { connectedGithub } from "./publishingAccess";

const mocks = vi.hoisted(() => ({
  token: vi.fn(),
  getInstallation: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("./githubApp", () => ({
  installationToken: mocks.token,
  PUBLISH_PERMISSIONS: { contents: "write" },
}));
vi.mock("./repositories/PublishingRepository", () => ({
  PublishingRepository: {
    getInstallation: mocks.getInstallation,
    revokeInstallation: mocks.revoke,
  },
}));

const connection: PublishingConnectionRecord = {
  id: "connection-1",
  projectId: "project-1",
  repositoryId: "123",
  owner: "PlaybookMediaLLC",
  repository: "monorepo",
  baseBranch: "main",
  rootDirectory: "apps/www",
  productionEnvironment: "production",
  transport: "github_app",
  installationRef: "installation-1",
  encryptedToken: null,
  tokenKeyVersion: 0,
  createdBy: "user-1",
  createdAt: new Date().toISOString(),
  revokedAt: null,
};

beforeEach(() => {
  mocks.getInstallation.mockResolvedValue({
    id: "installation-1",
    installationId: 7,
    revokedAt: null,
  });
});

it("records a revoked installation and asks to reconnect", async () => {
  mocks.token.mockRejectedValue(new AppError("NOT_FOUND"));
  await expect(
    connectedGithub(connection, new AbortController().signal),
  ).rejects.toMatchObject({
    code: "CONFLICT",
    message: "Reconnect the GitHub App.",
  });
  expect(mocks.revoke).toHaveBeenCalledWith(
    "installation-1",
    expect.objectContaining({ action: "github_app.revoked" }),
  );
});

it("asks for a token for the connected repository only", async () => {
  mocks.token.mockResolvedValue("ghs_token");
  await connectedGithub(connection, new AbortController().signal, {
    metadata: "read",
    deployments: "read",
  });
  expect(mocks.token).toHaveBeenCalledWith({
    installationId: 7,
    repositoryId: "123",
    permissions: { metadata: "read", deployments: "read" },
  });
});
