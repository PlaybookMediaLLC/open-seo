import type { MetadataProposal } from "@/types/schemas/publishing";

async function digest(algorithm: "SHA-1" | "SHA-256", value: string) {
  const hash = await crypto.subtle.digest(
    algorithm,
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function gitBlobHash(source: string) {
  return digest(
    "SHA-1",
    `blob ${new TextEncoder().encode(source).byteLength}\0${source}`,
  );
}

export function proposalFingerprint(
  proposal: Omit<MetadataProposal, "changeHash">,
) {
  // Explicit ordered tuple, not JSON persistence. All reviewed fields are bound.
  return digest(
    "SHA-256",
    JSON.stringify([
      proposal.id,
      proposal.projectId,
      proposal.opportunityId,
      proposal.connectionId,
      proposal.evidenceRunId,
      proposal.opportunityVersion,
      proposal.targetUrl,
      proposal.filePath,
      proposal.baseSha,
      proposal.beforeBlobSha,
      proposal.afterBlobSha,
      proposal.descriptionBefore,
      proposal.descriptionAfter,
      proposal.beforeSnippet,
      proposal.afterSnippet,
      proposal.reason,
      proposal.expectedEffect,
      proposal.risk,
      proposal.verificationPlan,
      proposal.validationSummary,
      proposal.createdBy,
      proposal.createdAt,
      // Version 2 binds the helper and title fields. Version 1 rows keep their
      // original hash: the helper fields were appended only for helper calls.
      ...(proposal.fingerprintVersion === 2
        ? [
            2,
            proposal.metadataSource,
            proposal.helperPath,
            proposal.helperBlobSha,
            proposal.titleBefore,
            proposal.titleAfter,
            proposal.titleBeforeSnippet,
            proposal.titleAfterSnippet,
          ]
        : proposal.metadataSource === "helper_call"
          ? [
              proposal.metadataSource,
              proposal.helperPath,
              proposal.helperBlobSha,
            ]
          : []),
    ]),
  );
}
