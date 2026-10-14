import { z } from "zod";

const projectScope = z.object({ projectId: z.string().min(1) });
const repositoryPart = z.string().regex(/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$/);
const owner = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/);
const branch = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9_-][A-Za-z0-9_./-]*$/)
  .refine(
    (value) =>
      !value.includes("..") &&
      value
        .split("/")
        .every(
          (part) =>
            part &&
            !part.startsWith(".") &&
            !part.endsWith(".") &&
            !part.endsWith(".lock"),
        ),
  );
const rootDirectory = z
  .string()
  .max(200)
  .regex(/^(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/)
  .default("");
export const publishingProjectInputSchema = projectScope;
export const connectPublishingInputSchema = projectScope.extend({
  owner,
  repository: repositoryPart,
  baseBranch: branch,
  rootDirectory,
  token: z
    .string()
    .trim()
    .regex(/^github_pat_[A-Za-z0-9_]{20,245}$/),
  authorizeRepositoryAccess: z.literal(true),
});
export const prepareProposalInputSchema = projectScope.extend({
  opportunityId: z.string().min(1),
  expectedOpportunityVersion: z.number().int().positive(),
  filePath: z.string().min(1).max(300),
  newDescription: z
    .string()
    .trim()
    .min(1)
    .max(320)
    .refine((value) => !/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(value)),
});
export const publishingOpportunityInputSchema = projectScope.extend({
  opportunityId: z.string().min(1),
});
export const executeProposalInputSchema = projectScope.extend({
  proposalId: z.string().min(1),
  changeHash: z.string().regex(/^[a-f0-9]{64}$/),
  authorizePullRequest: z.literal(true),
  note: z.string().trim().max(2000).default(""),
});
export type ConnectPublishingInput = z.infer<
  typeof connectPublishingInputSchema
>;
export type PrepareProposalInput = z.infer<typeof prepareProposalInputSchema>;
export type ExecuteProposalInput = z.infer<typeof executeProposalInputSchema>;
export const recoverPublishingInputSchema = publishingOpportunityInputSchema.extend({
  expectedVersion: z.number().int().positive(),
  confirmRecovery: z.literal(true),
});
export type RecoverPublishingInput = z.infer<typeof recoverPublishingInputSchema>;

export type PublishingMutationResult = {
  ok: boolean;
  message: string;
  proposalId?: string;
  executionId?: string;
};

export type PublishingConnection = {
  id: string;
  projectId: string;
  repositoryId: string;
  owner: string;
  repository: string;
  baseBranch: string;
  rootDirectory: string;
  createdBy: string;
  createdAt: string;
  revokedAt: string | null;
};
export type PublishingConnectionRecord = PublishingConnection & {
  encryptedToken: string | null;
};
export type MetadataProposal = {
  id: string;
  projectId: string;
  opportunityId: string;
  connectionId: string;
  evidenceRunId: string;
  opportunityVersion: number;
  targetUrl: string;
  filePath: string;
  baseSha: string;
  beforeBlobSha: string;
  afterBlobSha: string;
  descriptionBefore: string;
  descriptionAfter: string;
  beforeSnippet: string;
  afterSnippet: string;
  changeHash: string;
  reason: string;
  expectedEffect: string;
  risk: string;
  verificationPlan: string;
  validationSummary: string;
  createdBy: string;
  createdAt: string;
};
export type ProposalApproval = {
  id: string;
  projectId: string;
  proposalId: string;
  actorUserId: string;
  changeHash: string;
  note: string;
  createdAt: string;
};
export type ExecutionPhase =
  | "validating"
  | "branch_created"
  | "file_committed"
  | "pull_request_created"
  | "failed";
export type ProposalExecution = {
  id: string;
  projectId: string;
  proposalId: string;
  approvalId: string;
  status: "running" | "succeeded" | "failed";
  phase: ExecutionPhase;
  branchName: string;
  startedAt: string;
  finishedAt: string | null;
  requestCount: number;
  commitSha: string | null;
  pullRequestNumber: number | null;
  pullRequestUrl: string | null;
  error: string | null;
};
export type ExecutionEvent = {
  id: string;
  projectId: string;
  executionId: string;
  phase: ExecutionPhase;
  message: string;
  createdAt: string;
};
export type ProposalWithHistory = {
  proposal: MetadataProposal;
  connection: PublishingConnection;
  approvals: ProposalApproval[];
  executions: ProposalExecution[];
  events: ExecutionEvent[];
};
export type PublishingOpportunityState = {
  configured: boolean;
  canManage: boolean;
  connection: PublishingConnection | null;
  proposals: ProposalWithHistory[];
};
