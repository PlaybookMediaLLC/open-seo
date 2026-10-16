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
  productionEnvironment: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[\x20-\x7e]+$/)
    .default("Production"),
});
export const productionEnvironmentInputSchema = projectScope.extend({
  productionEnvironment: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[\x20-\x7e]+$/),
});
const metadataText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(value));
export const prepareProposalInputSchema = projectScope
  .extend({
    opportunityId: z.string().min(1),
    expectedOpportunityVersion: z.number().int().positive(),
    filePath: z.string().min(1).max(300),
    newDescription: metadataText(320).optional(),
    newTitle: metadataText(120).optional(),
    newCanonical: z.string().trim().min(1).max(500).optional(),
    newRobots: z.object({ index: z.boolean(), follow: z.boolean() }).optional(),
    // The page path typed by the person, for canonical and robots changes.
    confirmPath: z.string().max(500).optional(),
  })
  .refine((value) => {
    const text =
      value.newDescription !== undefined || value.newTitle !== undefined;
    const indexing =
      value.newCanonical !== undefined || value.newRobots !== undefined;
    return text !== indexing;
  }, "Change the title and description, or the canonical URL and robots, in one proposal.");
export const publishingOpportunityInputSchema = projectScope.extend({
  opportunityId: z.string().min(1),
});
export const proposalInputSchema = projectScope.extend({
  proposalId: z.string().min(1),
});
export type ProposalInput = z.infer<typeof proposalInputSchema>;
export const confirmRevertInputSchema = proposalInputSchema.extend({
  deployedAt: z.iso.datetime({ offset: true }),
  note: z.string().trim().min(1).max(2000),
  confirmProductionDeployment: z.literal(true),
});
export type ConfirmRevertInput = z.infer<typeof confirmRevertInputSchema>;
export const executeProposalInputSchema = projectScope.extend({
  proposalId: z.string().min(1),
  changeHash: z.string().regex(/^[a-f0-9]{64}$/),
  authorizePullRequest: z.literal(true),
  note: z.string().trim().max(2000).default(""),
});
export type ConnectPublishingInput = z.input<
  typeof connectPublishingInputSchema
>;
export type ProductionEnvironmentInput = z.infer<
  typeof productionEnvironmentInputSchema
>;
export type PrepareProposalInput = z.infer<typeof prepareProposalInputSchema>;
export type ExecuteProposalInput = z.infer<typeof executeProposalInputSchema>;
export const recoverPublishingInputSchema =
  publishingOpportunityInputSchema.extend({
    expectedVersion: z.number().int().positive(),
    confirmRecovery: z.literal(true),
  });
export type RecoverPublishingInput = z.infer<
  typeof recoverPublishingInputSchema
>;

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
  productionEnvironment: string;
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
  metadataSource: "literal_object" | "helper_call";
  helperPath: string | null;
  helperBlobSha: string | null;
  titleBefore: string | null;
  titleAfter: string | null;
  titleBeforeSnippet: string | null;
  titleAfterSnippet: string | null;
  canonicalBefore: string | null;
  canonicalAfter: string | null;
  canonicalBeforeSnippet: string | null;
  canonicalAfterSnippet: string | null;
  robotsBefore: string | null;
  robotsAfter: string | null;
  robotsBeforeSnippet: string | null;
  robotsAfterSnippet: string | null;
  adapterId: "app_router_metadata" | "pages_router_head";
  fingerprintVersion: number;
  revertsProposalId: string | null;
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
