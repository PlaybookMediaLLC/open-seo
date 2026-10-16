import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@/server/lib/errors";
import type * as PublishingAccess from "./publishingAccess";
import { GithubIssueService } from "./GithubIssueService";

const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  claimTicket: vi.fn(),
  completeTicket: vi.fn(),
  getTicket: vi.fn(),
  createIssue:
    vi.fn<(input: { title: string; body: string }) => Promise<unknown>>(),
  findIssue: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("./publishingAccess", async (actual) => ({
  ...(await actual<typeof PublishingAccess>()),
  authorizePublishing: vi.fn(),
  withPublishingClaim: (
    _context: unknown,
    _projectId: string,
    run: (claim: string, signal: AbortSignal) => unknown,
  ) => run("claim-1", new AbortController().signal),
  connectedGithub: () => ({
    createIssue: mocks.createIssue,
    findIssue: mocks.findIssue,
  }),
}));
vi.mock(
  "@/server/features/opportunities/repositories/OpportunityRepository",
  () => ({ OpportunityRepository: { getDetail: mocks.detail } }),
);
vi.mock("./repositories/PublishingRepository", () => ({
  PublishingRepository: {
    getConnection: async () => ({ id: "connection-1" }),
    claimTicket: mocks.claimTicket,
    completeTicket: mocks.completeTicket,
    getTicket: mocks.getTicket,
  },
}));

import { opportunityDetail } from "@/server/features/opportunities/services/opportunityTestFixtures";

const context = { organizationId: "org-1", userId: "user-1", role: "owner" };
const scope = { projectId: "project-1", opportunityId: "opportunity-1" };
async function approvedHash() {
  const preview = await GithubIssueService.preview(context, scope);
  if (!preview) throw new Error("No preview");
  return preview.textHash;
}

beforeEach(() => {
  const detail = opportunityDetail("approved");
  detail.opportunity.title = "Improve the pricing snippet";
  mocks.detail.mockResolvedValue(detail);
  mocks.getTicket.mockResolvedValue(null);
  // A new row comes back with the id that the service generated.
  mocks.claimTicket.mockImplementation(
    async (input: { ticket: { id: string } }) => input.ticket,
  );
  mocks.completeTicket.mockResolvedValue(true);
  mocks.createIssue.mockResolvedValue({
    number: 7,
    url: "https://github.com/owner/site/issues/7",
  });
});

it("creates one issue from the approved text, with a hidden marker", async () => {
  const textHash = await approvedHash();
  const result = await GithubIssueService.create(context, {
    ...scope,
    textHash,
    confirmExactText: true,
  });
  expect(result).toMatchObject({
    ok: true,
    issueUrl: "https://github.com/owner/site/issues/7",
  });
  expect(mocks.createIssue).toHaveBeenCalledTimes(1);
  expect(mocks.createIssue.mock.calls[0][0].body).toContain(
    `<!-- Relay ticket:${textHash} -->`,
  );
});

it("makes no second issue for the same approval", async () => {
  mocks.claimTicket.mockResolvedValue({
    id: "first",
    issueNumber: 7,
    issueUrl: "https://github.com/owner/site/issues/7",
  });
  const result = await GithubIssueService.create(context, {
    ...scope,
    textHash: await approvedHash(),
    confirmExactText: true,
  });
  expect(result.message).toContain("already has issue #7");
  expect(mocks.createIssue).not.toHaveBeenCalled();
});

it("refuses text that is not the approved text", async () => {
  const result = await GithubIssueService.create(context, {
    ...scope,
    textHash: "b".repeat(64),
    confirmExactText: true,
  });
  expect(result).toEqual({
    ok: false,
    message: "The ticket text changed. Review it again.",
  });
  expect(mocks.claimTicket).not.toHaveBeenCalled();
});

it("asks for Issues write access on 403", async () => {
  mocks.createIssue.mockRejectedValue(new AppError("FORBIDDEN"));
  const result = await GithubIssueService.create(context, {
    ...scope,
    textHash: await approvedHash(),
    confirmExactText: true,
  });
  expect(result.message).toBe(
    "Add Issues read and write access to the token to create issues.",
  );
});
