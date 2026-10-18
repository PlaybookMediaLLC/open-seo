import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/server/lib/errors";
import type { DeploymentSignal } from "@/types/schemas/experiments";
import { DeploymentSignalService } from "./DeploymentSignalService";
import { ExperimentService } from "./ExperimentService";

const sha = "a".repeat(40);
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  listSignals: vi.fn(),
  recordSignal: vi.fn<(input: { signal: DeploymentSignal }) => Promise<void>>(),
  confirmDeployment: vi.fn(),
  connection: vi.fn(),
  listDeployments: vi.fn(),
  listDeploymentStatuses: vi.fn(),
  live: vi.fn(),
  pull: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/server/features/publishing/publishingAccess", () => ({
  authorizePublishing: vi.fn(),
  withPublishingClaim: (
    _context: unknown,
    _projectId: string,
    run: (claim: string, signal: AbortSignal) => unknown,
  ) => run("claim-1", new AbortController().signal),
  connectedGithub: () => ({
    listDeployments: mocks.listDeployments,
    listDeploymentStatuses: mocks.listDeploymentStatuses,
  }),
}));
vi.mock(
  "@/server/features/publishing/repositories/PublishingRepository",
  () => ({
    PublishingRepository: { getConnection: mocks.connection },
  }),
);
vi.mock("./repositories/ExperimentRepository", () => ({
  ExperimentRepository: {
    get: mocks.get,
    listSignals: mocks.listSignals,
    recordSignal: mocks.recordSignal,
    confirmDeployment: mocks.confirmDeployment,
  },
}));
vi.mock("./liveMetadata", () => ({ fetchLiveMetadata: mocks.live }));
vi.mock("./experimentPullStatus", () => ({ refreshPullStatus: mocks.pull }));

const context = { organizationId: "org-1", userId: "user-1", role: "owner" };
const input = { projectId: "project-1", experimentId: "experiment-1" };
const experiment = {
  id: "experiment-1",
  projectId: "project-1",
  targetUrl: "https://example.com/pricing",
  pullRequestState: "merged",
  mergedAt: "2026-10-01T00:00:00.000Z",
  mergeCommitSha: sha,
  deployedAt: null,
};
const recorded = () =>
  mocks.recordSignal.mock.calls.map(([call]) => call.signal.kind);

beforeEach(() => {
  mocks.get.mockResolvedValue({
    experiment,
    publishing: {
      connection: { repositoryId: "repo-1" },
      proposal: {
        descriptionBefore: "Old",
        descriptionAfter: "Choose a plan today.",
        titleAfter: null,
      },
    },
  });
  mocks.connection.mockResolvedValue({
    repositoryId: "repo-1",
    productionEnvironment: "Production",
  });
  mocks.listDeployments.mockResolvedValue([
    { id: 7, environment: "production", sha },
  ]);
  mocks.listDeploymentStatuses.mockResolvedValue([
    { state: "success", created_at: "2026-10-01T01:00:00Z" },
  ]);
  mocks.live.mockResolvedValue({
    title: "Pricing",
    description: "Choose a plan today.",
  });
  mocks.recordSignal.mockResolvedValue(undefined);
  mocks.pull.mockResolvedValue(experiment);
  mocks.confirmDeployment.mockResolvedValue(true);
});

describe("DeploymentSignalService.refresh", () => {
  it("records a successful production deployment and a live page match", async () => {
    const result = await DeploymentSignalService.refresh(context, input);
    expect(result.ok).toBe(true);
    expect(recorded()).toEqual(["github_deployment", "live_content_match"]);
    expect(mocks.recordSignal.mock.calls[0][0].signal).toMatchObject({
      effectiveAt: "2026-10-01T01:00:00.000Z",
      externalId: "7",
    });
  });

  it.each([
    [
      "another environment",
      () =>
        mocks.listDeployments.mockResolvedValue([
          { id: 7, environment: "staging", sha },
        ]),
    ],
    [
      "a failed status",
      () =>
        mocks.listDeploymentStatuses.mockResolvedValue([
          { state: "failure", created_at: "2026-10-01T01:00:00Z" },
        ]),
    ],
  ])("records no GitHub signal for %s", async (_name, arrange) => {
    arrange();
    await DeploymentSignalService.refresh(context, input);
    expect(recorded()).toEqual(["live_content_match"]);
  });

  it("asks for Deployments read access on 403 and still checks the page", async () => {
    mocks.listDeployments.mockRejectedValue(new AppError("FORBIDDEN"));
    const result = await DeploymentSignalService.refresh(context, input);
    expect(result.message).toContain(
      "Add Deployments read access to see deployment status.",
    );
    expect(recorded()).toEqual(["live_content_match"]);
  });

  it("records no live signal when the page shows other text", async () => {
    mocks.live.mockResolvedValue({ title: "Pricing", description: "Old" });
    const result = await DeploymentSignalService.refresh(context, input);
    expect(recorded()).toEqual(["github_deployment"]);
    expect(result.message).toContain("does not show the approved text yet");
  });

  it("records no live signal for a change without a title or description", async () => {
    mocks.get.mockResolvedValue({
      experiment,
      publishing: {
        connection: { repositoryId: "repo-1" },
        proposal: {
          descriptionBefore: "",
          descriptionAfter: "",
          titleAfter: null,
        },
      },
    });
    const result = await DeploymentSignalService.refresh(context, input);
    expect(recorded()).toEqual(["github_deployment"]);
    expect(result.message).toContain("Confirm this deployment yourself");
  });
});

const signal = (kind: DeploymentSignal["kind"]) => ({
  kind,
  effectiveAt: "2026-10-01T01:00:00.000Z",
  externalId: kind === "github_deployment" ? "7" : "live",
});

describe("ExperimentService.confirmVerifiedDeployment", () => {
  const confirm = () =>
    ExperimentService.confirmVerifiedDeployment(context, {
      ...input,
      otherChanges: false,
      seasonalRisk: false,
    });

  it("refuses a single signal", async () => {
    mocks.listSignals.mockResolvedValue([signal("github_deployment")]);
    expect(await confirm()).toMatchObject({ ok: false });
    expect(mocks.confirmDeployment).not.toHaveBeenCalled();
  });

  it("starts measurement at the GitHub deployment time with both signals", async () => {
    mocks.listSignals.mockResolvedValue([
      signal("github_deployment"),
      signal("live_content_match"),
    ]);
    expect(await confirm()).toMatchObject({ ok: true });
    expect(mocks.confirmDeployment).toHaveBeenCalledWith(
      expect.objectContaining({
        basis: "verified",
        deployedAt: "2026-10-01T01:00:00.000Z",
      }),
    );
  });
});
