import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@/server/lib/errors";
import { getRepositoryChecks } from "./repositoryChecks";

const mocks = vi.hoisted(() => ({
  getProposal: vi.fn(),
  getConnectionById: vi.fn(),
  getChecks: vi.fn(),
}));
vi.mock("./publishingAccess", () => ({
  authorizePublishing: vi.fn(),
  connectedGithub: () => ({ getChecks: mocks.getChecks }),
}));
vi.mock("./repositories/PublishingRepository", () => ({
  PublishingRepository: {
    getProposal: mocks.getProposal,
    getConnectionById: mocks.getConnectionById,
  },
}));

const context = { organizationId: "org-1", userId: "user-1", role: "member" };
const input = { projectId: "project-1", proposalId: "proposal-1" };

beforeEach(() => {
  mocks.getProposal.mockResolvedValue({
    proposal: { connectionId: "connection-1" },
    executions: [{ status: "succeeded", commitSha: "b".repeat(40) }],
  });
  mocks.getConnectionById.mockResolvedValue({ id: "connection-1" });
});

it("reads the checks of the pull request head", async () => {
  mocks.getChecks.mockResolvedValue("passing");
  expect(await getRepositoryChecks(context, input)).toEqual({
    state: "passing",
    message: null,
  });
  expect(mocks.getChecks).toHaveBeenCalledWith("b".repeat(40));
});

it("names the missing permissions on 403", async () => {
  mocks.getChecks.mockRejectedValue(new AppError("FORBIDDEN"));
  expect(await getRepositoryChecks(context, input)).toEqual({
    state: null,
    message:
      "Add Checks read and Commit statuses read access to the token to see your repository's checks.",
  });
});
