import { symmetricDecrypt } from "better-auth/crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConnectPublishingInput } from "@/types/schemas/publishing";
import { PublishingConnectionService } from "./PublishingConnectionService";
import {
  makePublishingFixture,
  publishingTestSecret,
  publishingTestToken,
} from "./publishing-test-fixtures";
import type { PublishingRepository } from "./repositories/PublishingRepository";

const mocks = vi.hoisted(() => ({
  project: vi.fn(),
  env: vi.fn(),
  claim: vi.fn(),
  finish: vi.fn(),
  connection: vi.fn(),
  installation: vi.fn(),
  replace: vi.fn<typeof PublishingRepository.replaceConnection>(),
  disconnect: vi.fn(),
  client: vi.fn(),
  repository: vi.fn(),
  ref: vi.fn(),
  createRef: vi.fn(),
  updateFile: vi.fn(),
  createPullRequest: vi.fn(),
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
vi.mock("./repositories/PublishingRepository", () => ({
  PublishingRepository: {
    getConnection: mocks.connection,
    getInstallation: mocks.installation,
    replaceConnection: mocks.replace,
    disconnect: mocks.disconnect,
  },
}));
vi.mock("./githubClient", () => ({ createGithubClient: mocks.client }));
let fixture: Awaited<ReturnType<typeof makePublishingFixture>>;
let input: ConnectPublishingInput;
beforeEach(async () => {
  fixture = await makePublishingFixture();
  input = {
    projectId: fixture.connection.projectId,
    owner: "example",
    repository: "website",
    baseBranch: "main",
    rootDirectory: "",
    token: publishingTestToken,
    authorizeRepositoryAccess: true,
  };
  mocks.project.mockResolvedValue({ id: input.projectId });
  mocks.env.mockResolvedValue(publishingTestSecret);
  mocks.claim.mockResolvedValue("claim-1");
  mocks.finish.mockResolvedValue(undefined);
  mocks.connection.mockResolvedValue(fixture.connection);
  mocks.replace.mockResolvedValue(true);
  mocks.disconnect.mockResolvedValue(true);
  mocks.repository.mockResolvedValue(fixture.repository);
  mocks.ref.mockResolvedValue({ sha: fixture.proposal.baseSha });
  mocks.client.mockReturnValue({
    getRepository: mocks.repository,
    getRef: mocks.ref,
    createRef: mocks.createRef,
    updateFile: mocks.updateFile,
    createPullRequest: mocks.createPullRequest,
  });
});

describe("PublishingConnectionService", () => {
  it.each(["get", "connect", "disconnect"] as const)(
    "scopes %s to the caller organization before accessing connections",
    async (method) => {
      mocks.project.mockResolvedValue(null);
      const calls = {
        get: () =>
          PublishingConnectionService.get(fixture.context, input.projectId),
        connect: () =>
          PublishingConnectionService.connect(fixture.context, input),
        disconnect: () =>
          PublishingConnectionService.disconnect(
            fixture.context,
            input.projectId,
          ),
      };
      await expect(calls[method]()).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(mocks.project).toHaveBeenCalledWith(
        input.projectId,
        fixture.context.organizationId,
      );
      expect(mocks.connection).not.toHaveBeenCalled();
      expect(mocks.claim).not.toHaveBeenCalled();
      expect(mocks.client).not.toHaveBeenCalled();
    },
  );

  it("allows member reads without exposing either token representation", async () => {
    const result = await PublishingConnectionService.get(
      { ...fixture.context, role: "member" },
      input.projectId,
    );
    expect(result).toMatchObject({
      configured: true,
      canManage: false,
      connection: { id: fixture.connection.id, repository: "website" },
    });
    expect(result.connection).not.toHaveProperty("encryptedToken");
    expect(JSON.stringify(result)).not.toContain(publishingTestToken);
    expect(JSON.stringify(result)).not.toContain(
      fixture.connection.encryptedToken!,
    );
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("reports an App connection whose installation was uninstalled", async () => {
    mocks.connection.mockResolvedValue({
      ...fixture.connection,
      transport: "github_app",
      installationRef: "installation-1",
      encryptedToken: null,
    });
    mocks.installation.mockResolvedValue({ revokedAt: "2026-10-16T12:34:03Z" });
    await expect(
      PublishingConnectionService.get(fixture.context, input.projectId),
    ).resolves.toMatchObject({ appRevoked: true });
    expect(mocks.installation).toHaveBeenCalledWith("installation-1");
  });

  it.each(["connect", "disconnect"] as const)(
    "requires integration management permission for %s",
    async (method) => {
      const context = { ...fixture.context, role: "member" };
      const result =
        method === "connect"
          ? PublishingConnectionService.connect(context, input)
          : PublishingConnectionService.disconnect(context, input.projectId);
      await expect(result).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(mocks.claim).not.toHaveBeenCalled();
      expect(mocks.client).not.toHaveBeenCalled();
    },
  );

  it("requires explicit repository-access consent before any external call", async () => {
    Reflect.set(input, "authorizeRepositoryAccess", false);
    await expect(
      PublishingConnectionService.connect(fixture.context, input),
    ).rejects.toThrow();
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it.each([undefined, "too-short"])(
    "fails closed without a usable encryption secret",
    async (secret) => {
      mocks.env.mockResolvedValue(secret);
      const result = await PublishingConnectionService.connect(
        fixture.context,
        input,
      );
      expect(result.ok).toBe(false);
      expect(result.message).toContain("BETTER_AUTH_SECRET");
      expect(mocks.client).not.toHaveBeenCalled();
      expect(mocks.claim).not.toHaveBeenCalled();
      expect(mocks.replace).not.toHaveBeenCalled();
    },
  );

  it("encrypts the credential at rest and performs only repository and branch reads", async () => {
    const result = await PublishingConnectionService.connect(
      fixture.context,
      input,
    );
    expect(result.ok).toBe(true);
    const saved = mocks.replace.mock.calls[0][0];
    expect(saved).toMatchObject({
      organizationId: fixture.context.organizationId,
      claimToken: "claim-1",
      connection: {
        projectId: input.projectId,
        repositoryId: "123",
        owner: input.owner,
      },
    });
    expect(saved.connection.encryptedToken).not.toBe(publishingTestToken);
    expect(
      await symmetricDecrypt({
        key: publishingTestSecret,
        data: saved.connection.encryptedToken!,
      }),
    ).toBe(publishingTestToken);
    expect(JSON.stringify(result)).not.toContain(publishingTestToken);
    expect(JSON.stringify(result)).not.toContain(
      saved.connection.encryptedToken!,
    );
    expect(mocks.createRef).not.toHaveBeenCalled();
    expect(mocks.updateFile).not.toHaveBeenCalled();
    expect(mocks.createPullRequest).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledWith(
      `publishing:${input.projectId}`,
      "claim-1",
      0,
    );
  });

  it.each(["claim", "provider", "cas"])(
    "preserves the existing connection when %s fails",
    async (failure) => {
      if (failure === "claim") mocks.claim.mockResolvedValue(null);
      if (failure === "provider")
        mocks.repository.mockRejectedValue(
          new Error(`upstream ${publishingTestToken}`),
        );
      if (failure === "cas") mocks.replace.mockResolvedValue(false);
      const result = await PublishingConnectionService.connect(
        fixture.context,
        input,
      );
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain(publishingTestToken);
      expect(mocks.disconnect).not.toHaveBeenCalled();
      if (failure !== "cas") expect(mocks.replace).not.toHaveBeenCalled();
      if (failure === "claim") expect(mocks.client).not.toHaveBeenCalled();
    },
  );

  it("disconnects only the scoped local connection without touching remote work", async () => {
    expect(
      await PublishingConnectionService.disconnect(
        fixture.context,
        input.projectId,
      ),
    ).toMatchObject({ ok: true });
    expect(mocks.disconnect.mock.lastCall?.[0]).toMatchObject({
      projectId: input.projectId,
      claimToken: "claim-1",
      organizationId: fixture.context.organizationId,
      audit: { action: "publishing.disconnected" },
    });
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("reports a lost disconnect CAS rather than claiming access was removed", async () => {
    mocks.disconnect.mockResolvedValue(false);
    expect(
      await PublishingConnectionService.disconnect(
        fixture.context,
        input.projectId,
      ),
    ).toMatchObject({ ok: false });
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
