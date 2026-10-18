import { describe, expect, it } from "vitest";
import type { MetadataProposal } from "@/types/schemas/publishing";
import { proposalFingerprint } from "./proposalFingerprint";

const v1: Omit<MetadataProposal, "changeHash"> = {
  id: "p-1",
  projectId: "proj-1",
  opportunityId: "opp-1",
  connectionId: "c-1",
  evidenceRunId: "run-1",
  opportunityVersion: 3,
  targetUrl: "https://example.com/pricing",
  filePath: "app/pricing/page.tsx",
  baseSha: "a".repeat(40),
  beforeBlobSha: "b".repeat(40),
  afterBlobSha: "c".repeat(40),
  descriptionBefore: "Old",
  descriptionAfter: "New",
  beforeSnippet: 'Line 1: "Old"',
  afterSnippet: "Line 1: 'New'",
  metadataSource: "literal_object",
  helperPath: null,
  helperBlobSha: null,
  titleBefore: null,
  titleAfter: null,
  titleBeforeSnippet: null,
  titleAfterSnippet: null,
  canonicalBefore: null,
  canonicalAfter: null,
  canonicalBeforeSnippet: null,
  canonicalAfterSnippet: null,
  robotsBefore: null,
  robotsAfter: null,
  robotsBeforeSnippet: null,
  robotsAfterSnippet: null,
  revertsProposalId: null,
  draftId: null,
  adapterId: "app_router_metadata",
  fingerprintVersion: 1,
  changeKind: "metadata",
  reason: "r",
  expectedEffect: "e",
  risk: "k",
  verificationPlan: "v",
  validationSummary: "s",
  createdBy: "u-1",
  createdAt: "2026-10-16T00:00:00.000Z",
};

describe("proposalFingerprint", () => {
  it("keeps the hash of a version 1 proposal stored before titles existed", async () => {
    // Computed with the fingerprint code before version 2 was added.
    expect(await proposalFingerprint(v1)).toBe(
      "c3ea6750bebde6f7dc8d7e8dbdb2cfb8c0d1abdfae1a08b359cb08558539fdc1",
    );
  });

  it("binds the change kind and every text edit in version 6", async () => {
    const v6 = {
      ...v1,
      fingerprintVersion: 6,
      changeKind: "copy_text" as const,
    };
    const edit = {
      ordinal: 0,
      filePath: "lib/content.ts",
      nodeKind: "string_literal" as const,
      beforeBlobSha: "a".repeat(40),
      afterBlobSha: "b".repeat(40),
      beforeText: "Book a call",
      afterText: "Talk to sales",
      beforeSnippet: "cta: 'Book a call',",
      afterSnippet: "cta: 'Talk to sales',",
    };
    expect(await proposalFingerprint(v6, [edit])).not.toBe(
      await proposalFingerprint(v6, [{ ...edit, afterText: "Call us" }]),
    );
  });

  it("binds the title in version 2", async () => {
    const v2 = { ...v1, fingerprintVersion: 2, titleAfter: "New title" };
    expect(await proposalFingerprint(v2)).not.toBe(
      await proposalFingerprint({ ...v2, titleAfter: "Other title" }),
    );
  });
});
