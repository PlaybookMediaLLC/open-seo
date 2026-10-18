import { OpportunityRepository } from "@/server/features/opportunities/repositories/OpportunityRepository";
import { AppError } from "@/server/lib/errors";
import type {
  DraftProposalTextInput,
  ProposalDraft,
} from "@/types/schemas/proposalDrafts";
import { draftAnchor } from "./anchorDraft";
import { generateChecked } from "./checkedGeneration";
import {
  admitDraft,
  digest,
  visible,
  withDraftLease,
  type DraftContext,
} from "./draftAdmission";
import { checkDraft, draftOutputSchema, LENGTH_RULES } from "./draftChecks";
import {
  draftEvidence,
  gatherDraftInputs,
  promptFor,
  READ_ONLY,
  systemPrompt,
} from "./draftInputs";
import { locateMetadataFile, type LocateResult } from "./fileLocator";
import {
  authorizePublishing,
  connectedGithub,
  withPublishingClaim,
  type PublishingContext,
} from "./publishingAccess";
import { ProposalDraftRepository } from "./repositories/ProposalDraftRepository";
import { PublishingRepository } from "./repositories/PublishingRepository";

const PROMPT_VERSIONS = {
  meta_description: "description-v2",
  meta_title: "title-v1",
} as const;

/** RFC-0004 5.2: find the page file before any draft or proposal. */
async function locate(
  context: PublishingContext,
  input: { projectId: string; opportunityId: string },
): Promise<LocateResult> {
  await authorizePublishing(context, input.projectId);
  const detail = await OpportunityRepository.getDetail(
    input.projectId,
    input.opportunityId,
  );
  if (!detail) throw new AppError("NOT_FOUND");
  const connection = await PublishingRepository.getConnection(input.projectId);
  if (!connection)
    return {
      status: "not_found",
      message: "Connect GitHub publishing to find the page file.",
    };
  return withPublishingClaim(
    context,
    input.projectId,
    async (_token, signal) => {
      const client = await connectedGithub(connection, signal, READ_ONLY);
      return locateMetadataFile(
        client.request,
        connection,
        detail.opportunity.url,
      );
    },
  );
}

/**
 * RFC-0004 5.3: a checked description or title draft for an approved
 * opportunity. Two attempts at most; a draft that fails is stored, never shown.
 */
async function draft(
  context: DraftContext,
  input: DraftProposalTextInput,
): Promise<ProposalDraft> {
  const kind = input.kind ?? "meta_description";
  const { detail, customer } = await admitDraft(context, input, kind);
  const { opportunity } = detail;
  // An agent may leave the path out; the app always sends what it shows.
  const located = input.filePath ? null : await locate(context, input);
  const filePath =
    input.filePath ??
    (located?.status === "found" ? located.filePath : undefined);
  return withDraftLease(context, input.projectId, async () => {
    const { inputs, sections, templateExtra } = await gatherDraftInputs(
      context,
      input.projectId,
      detail,
      filePath,
      kind,
    );
    // A title's layout template adds characters to the final title.
    const base = LENGTH_RULES[kind];
    const rule = {
      label: templateExtra ? `${base.label} without the site name` : base.label,
      min: Math.max(1, base.min - templateExtra),
      max: base.max - templateExtra,
    };
    const result = await generateChecked({
      customer,
      operation: "proposal_draft",
      schema: draftOutputSchema,
      system: systemPrompt(kind, rule),
      prompt: promptFor(inputs, sections, kind),
      check: (output) => checkDraft(output, inputs, rule),
      maxOutputTokens: 1_000,
      timeoutMs: 30_000,
    });
    const output = result.output ?? result.rejected;
    const passed = result.output !== null;
    const { sources, claims } = draftEvidence(
      inputs,
      sections,
      output ?? { text: "", rationale: "", usedQueries: [], claims: [] },
      passed,
      kind,
    );
    const record: ProposalDraft = {
      id: crypto.randomUUID(),
      opportunityId: opportunity.id,
      opportunityVersion: opportunity.version,
      evidenceRunId: opportunity.evidenceRunId,
      kind,
      status: passed ? "generated" : "rejected_by_validation",
      targetUrl: opportunity.url,
      filePath: filePath ?? null,
      valueBefore: inputs.currentValue,
      valueAfter: output?.text.trim() ?? "",
      rationale: output?.rationale ?? "",
      validationSummary: passed
        ? "Passed the length, character, change, number, quote, claim and query checks."
        : `Rejected: ${result.failures.join(" ")}`,
      model: result.modelId,
      promptVersion: PROMPT_VERSIONS[kind],
      inputDigest: await digest([PROMPT_VERSIONS[kind], inputs, sections]),
      costUsd: result.costUsd,
      createdBy: context.userId,
      createdAt: new Date().toISOString(),
      sources,
      claims,
    };
    await ProposalDraftRepository.save(input.projectId, record, {
      organizationId: context.organizationId,
      projectId: input.projectId,
      actor: context,
      action: "proposal.drafted",
      targetType: "opportunity",
      targetId: record.opportunityId,
      summary: `Drafted a ${record.kind.replaceAll("_", " ")} for ${record.targetUrl} (${record.status})`,
    });
    return visible(record);
  });
}

async function list(
  context: PublishingContext,
  input: { projectId: string; opportunityId: string },
) {
  await authorizePublishing(context, input.projectId);
  return (
    await ProposalDraftRepository.list(input.projectId, input.opportunityId)
  ).map(visible);
}

async function discard(
  context: PublishingContext,
  input: { projectId: string; draftId: string },
) {
  await authorizePublishing(context, input.projectId, true);
  await ProposalDraftRepository.discard(input.projectId, input.draftId);
}

export const ProposalDraftService = {
  locate,
  draft,
  draftAnchor,
  list,
  discard,
};
