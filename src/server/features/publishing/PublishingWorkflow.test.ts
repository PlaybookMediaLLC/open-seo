import { symmetricDecrypt } from "better-auth/crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { DataRefreshClaimRepository } from "@/server/features/dashboard/repositories/DataRefreshClaimRepository";
import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import { MetadataExecutionService } from "./MetadataExecutionService";
import { MetadataProposalService } from "./MetadataProposalService";
import { PublishingConnectionService } from "./PublishingConnectionService";
import { gitBlobHash } from "./proposalFingerprint";
import {
  publishingTestSecret,
  publishingTestToken,
} from "./publishing-test-fixtures";
import { PublishingRepository } from "./repositories/PublishingRepository";
import { fixture as seedPublishing } from "./repositories/publishingTestFixtures";

// The database must exist before hoisted module mocks wire real repositories to it.
const database = await vi.hoisted(async () => {
  const { createPublishingTestDatabase } =
    await import("./repositories/publishingTestDb");
  return createPublishingTestDatabase();
});
const mocks = vi.hoisted(() => ({ gsc: vi.fn() }));
vi.mock("cloudflare:workers", () => ({
  env: { DATABASE_PROVIDER: database.isPostgres ? "postgres" : "d1" },
}));
vi.mock("@/db", () => ({ db: database.db }));
vi.mock("@/db/d1/client", () => ({ d1Db: database.db }));
vi.mock("@/db/pg/client", () => ({ pgDb: database.db }));
vi.mock("@/server/features/gsc/services/GscService", () => ({
  GscService: { getConnection: mocks.gsc },
}));
const transport = vi.fn<typeof fetch>();
const source = "export const metadata = { description: 'Old description' };\n";
const newDescription = "Human reviewed page description.";
const afterSource =
  "export const metadata = { description: 'Human reviewed page description.' };\n";
const manifest = '{"dependencies":{"next":"15.4.0"}}';
const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);
const rootTree = "c".repeat(40);
const appTree = "d".repeat(40);
const pageTree = "e".repeat(40);
const filePath = "app/page/page.tsx";
let seed: Awaited<ReturnType<typeof seedPublishing>>;
let proposalId = "";

function ref(name: string, sha: string) {
  return { ref: `refs/heads/${name}`, object: { type: "commit", sha } };
}

beforeAll(async () => {
  await database.prepare();
  if (!database.isPostgres) {
    // Complete the harness's minimal project projection for the real org gate.
    await database.client.executeMultiple(`
      ALTER TABLE projects ADD COLUMN domain TEXT;
      ALTER TABLE projects ADD COLUMN location_code INTEGER DEFAULT 2840;
      ALTER TABLE projects ADD COLUMN language_code TEXT DEFAULT 'en';
      ALTER TABLE projects ADD COLUMN created_at TEXT;
      ALTER TABLE projects ADD COLUMN ai_research_keywords TEXT;
    `);
  }
});
afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await database.close();
});
beforeEach(async () => {
  seed = await seedPublishing(database);
  // Reuse the approved evidence seed, but begin this workflow disconnected.
  await PublishingRepository.disconnect(seed);
  await DataRefreshClaimRepository.finish(
    `publishing:${seed.projectId}`,
    seed.claimToken,
    0,
  );
  mocks.gsc.mockResolvedValue({ siteUrl: seed.siteUrl });
  vi.stubEnv("BETTER_AUTH_SECRET", publishingTestSecret);
  vi.stubGlobal("fetch", transport);
  proposalId = "";
  let branchSha: string | null = null;
  const beforeBlob = await gitBlobHash(source);
  const afterBlob = await gitBlobHash(afterSource);
  const manifestBlob = await gitBlobHash(manifest);
  const identity = {
    id: 123,
    name: "site",
    full_name: "owner/site",
    owner: { login: "owner" },
  };
  transport.mockImplementation(async (input, options) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(url.origin).toBe("https://api.github.com");
    const route = url.pathname.replace("/repos/owner/site", "");
    const method = options?.method ?? "GET";
    const branch = `growth/${proposalId}`;
    const requestBody: unknown =
      typeof options?.body === "string" ? JSON.parse(options.body) : undefined;
    if (method === "POST" && route === "/git/refs") {
      const body = z
        .object({ ref: z.string(), sha: z.string() })
        .parse(requestBody);
      expect(body).toEqual({ ref: `refs/heads/${branch}`, sha: baseSha });
      branchSha = baseSha;
      return Response.json(ref(branch, baseSha));
    }
    if (method === "PUT" && route === `/contents/${filePath}`) {
      const body = z
        .object({ branch: z.string(), sha: z.string(), content: z.string() })
        .parse(requestBody);
      expect(body.branch).toBe(branch);
      expect(body.sha).toBe(beforeBlob);
      expect(Buffer.from(body.content, "base64").toString("utf8")).toBe(
        afterSource,
      );
      branchSha = headSha;
      return Response.json({
        commit: { sha: headSha },
        content: { sha: afterBlob, path: filePath, type: "file" },
      });
    }
    if (method === "POST" && route === "/pulls") {
      const body = z
        .object({ head: z.string(), base: z.string(), body: z.string() })
        .parse(requestBody);
      expect(body.head).toBe(branch);
      expect(body.base).toBe("main");
      return Response.json({
        number: 7,
        html_url: "https://github.com/owner/site/pull/7",
        state: "open",
        merged: false,
        merged_at: null,
        body: body.body,
        head: { ref: branch, sha: headSha, repo: identity },
        base: { ref: "main", sha: baseSha, repo: identity },
      });
    }
    expect(method).toBe("GET");
    if (route === "")
      return Response.json({
        ...identity,
        default_branch: "main",
        private: true,
        archived: false,
        permissions: { push: true },
      });
    if (route === "/git/ref/heads/main")
      return Response.json(ref("main", baseSha));
    if (route === `/git/ref/heads/${branch}`)
      return branchSha
        ? Response.json(ref(branch, branchSha))
        : Response.json({}, { status: 404 });
    if (route === "/pulls") return Response.json([]);
    if (route === `/git/commits/${baseSha}`)
      return Response.json({
        sha: baseSha,
        tree: { sha: rootTree },
        parents: [],
      });
    if (route === `/git/commits/${headSha}`)
      return Response.json({
        sha: headSha,
        tree: { sha: "f".repeat(40) },
        parents: [{ sha: baseSha }],
      });
    const treeEntries = new Map([
      [
        rootTree,
        [
          {
            path: "package.json",
            mode: "100644",
            type: "blob",
            sha: manifestBlob,
          },
          { path: "app", mode: "040000", type: "tree", sha: appTree },
        ],
      ],
      [
        appTree,
        [{ path: "page", mode: "040000", type: "tree", sha: pageTree }],
      ],
      [
        pageTree,
        [{ path: "page.tsx", mode: "100644", type: "blob", sha: beforeBlob }],
      ],
    ]);
    for (const [sha, tree] of treeEntries) {
      if (route === `/git/trees/${sha}`)
        return Response.json({ sha, truncated: false, tree });
    }
    for (const [sha, text] of [
      [manifestBlob, manifest],
      [beforeBlob, source],
    ]) {
      if (route === `/git/blobs/${sha}`)
        return Response.json({
          sha,
          encoding: "base64",
          content: Buffer.from(text).toString("base64"),
          size: Buffer.byteLength(text),
        });
    }
    if (route === `/compare/${baseSha}...${headSha}`)
      return Response.json({
        status: "ahead",
        ahead_by: 1,
        behind_by: 0,
        total_commits: 1,
        base_commit: { sha: baseSha },
        merge_base_commit: { sha: baseSha },
        commits: [{ sha: headSha }],
        files: [{ filename: filePath, status: "modified", sha: afterBlob }],
      });
    throw new Error(`Unexpected mocked GitHub route: ${route}`);
  });
});

it(`connects, prepares and publishes an exact change once through real ${database.isPostgres ? "Postgres" : "SQLite"} repositories`, async () => {
  const context = {
    organizationId: seed.organizationId,
    userId: "reviewer",
    role: "owner",
  };
  const connected = await PublishingConnectionService.connect(context, {
    projectId: seed.projectId,
    owner: "owner",
    repository: "site",
    baseBranch: "main",
    rootDirectory: "",
    token: publishingTestToken,
    authorizeRepositoryAccess: true,
  });
  expect(connected.ok, connected.message).toBe(true);
  const connection = await PublishingRepository.getConnection(seed.projectId);
  if (!connection?.encryptedToken)
    throw new Error("Encrypted connection was not persisted");
  expect(connection.encryptedToken).not.toBe(publishingTestToken);
  expect(
    await symmetricDecrypt({
      key: publishingTestSecret,
      data: connection.encryptedToken,
    }),
  ).toBe(publishingTestToken);

  const prepared = await MetadataProposalService.prepare(context, {
    projectId: seed.projectId,
    opportunityId: seed.proposal.opportunityId,
    expectedOpportunityVersion: 2,
    filePath,
    newDescription,
  });
  expect(prepared.ok, prepared.message).toBe(true);
  if (!prepared.proposalId) throw new Error("Proposal was not persisted");
  proposalId = prepared.proposalId;
  const before = await PublishingRepository.getProposal(
    seed.projectId,
    proposalId,
  );
  if (!before) throw new Error("Proposal was not found");
  expect(before.proposal).toMatchObject({
    connectionId: connection.id,
    descriptionBefore: "Old description",
    descriptionAfter: newDescription,
    filePath,
  });
  expect(before.approvals).toEqual([]);
  expect(before.executions).toEqual([]);
  expect(
    transport.mock.calls.every(([, options]) => options?.method === "GET"),
  ).toBe(true);
  const request = {
    projectId: seed.projectId,
    proposalId,
    changeHash: before.proposal.changeHash,
    authorizePullRequest: true as const,
    note: "Reviewed exact copy.",
  };
  const executed = await MetadataExecutionService.execute(context, request);
  expect(executed.ok, executed.message).toBe(true);
  const history = await PublishingRepository.getProposal(
    seed.projectId,
    proposalId,
  );
  if (!history) throw new Error("Execution history was not persisted");
  expect(history.approvals).toHaveLength(1);
  expect(history.approvals[0]).toMatchObject({
    actorUserId: context.userId,
    changeHash: request.changeHash,
    note: request.note,
  });
  expect(history.executions).toHaveLength(1);
  expect(history.executions[0]).toMatchObject({
    id: executed.executionId,
    status: "succeeded",
    phase: "pull_request_created",
    commitSha: headSha,
    pullRequestNumber: 7,
    pullRequestUrl: "https://github.com/owner/site/pull/7",
  });
  expect(history.events).toHaveLength(4);
  expect(new Set(history.events.map((event) => event.phase))).toEqual(
    new Set([
      "branch_created",
      "file_committed",
      "pull_request_created",
      "validating",
    ]),
  );
  expect(
    (
      await OpportunityRepository.getDetail(
        seed.projectId,
        seed.proposal.opportunityId,
      )
    )?.opportunity.status,
  ).toBe("in_progress");
  expect(
    transport.mock.calls
      .filter(([, options]) => options?.method !== "GET")
      .map(([url, options]) => [options?.method, url]),
  ).toEqual([
    ["POST", "https://api.github.com/repos/owner/site/git/refs"],
    ["PUT", `https://api.github.com/repos/owner/site/contents/${filePath}`],
    ["POST", "https://api.github.com/repos/owner/site/pulls"],
  ]);
  const requestCount = transport.mock.calls.length;
  const retried = await MetadataExecutionService.execute(context, request);
  expect(retried).toMatchObject({
    ok: true,
    executionId: executed.executionId,
  });
  expect(transport).toHaveBeenCalledTimes(requestCount);
  const repeated = await PublishingRepository.getProposal(
    seed.projectId,
    proposalId,
  );
  expect(repeated?.approvals).toHaveLength(1);
  expect(repeated?.executions).toHaveLength(1);
  expect(
    JSON.stringify([connected, prepared, executed, history]),
  ).not.toContain(publishingTestToken);
});
