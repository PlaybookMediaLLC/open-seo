import { describe, expect, it } from "vitest";
import { opportunityTicket } from "./opportunityTicket";
import { opportunityDetail } from "./opportunityTestFixtures";

function detail() {
  const value = opportunityDetail("approved");
  value.opportunity.recommendedAction = "Rewrite the title.";
  value.opportunity.uncertainty = "Positions are averages.";
  value.evidence = [
    {
      id: "e1",
      opportunityId: value.opportunity.id,
      runId: value.opportunity.evidenceRunId,
      source: "google_search_console",
      period: "current",
      startDate: "2026-09-13",
      endDate: "2026-10-10",
      url: "",
      query: "",
      clicks: 12,
      impressions: 640,
      ctr: 0.01875,
      position: 8.4,
    },
    {
      id: "e0",
      opportunityId: value.opportunity.id,
      runId: "an-older-run",
      source: "google_search_console",
      period: "current",
      startDate: "2026-08-01",
      endDate: "2026-08-28",
      url: "",
      query: "",
      clicks: 999,
      impressions: 9999,
      ctr: 0.1,
      position: 2,
    },
  ];
  // People write notes; a note can hold anything, so the ticket never reads it.
  value.decisions = [
    {
      id: "d1",
      opportunityId: value.opportunity.id,
      evidenceRunId: value.opportunity.evidenceRunId,
      actorUserId: "user-1",
      decision: "approved",
      fromStatus: "reviewed",
      toStatus: "approved",
      note: "token ghp_secret123 from the admin",
      createdAt: "2026-10-16T00:00:00.000Z",
    },
  ];
  return value;
}

describe("opportunityTicket", () => {
  it("holds the URL, the evidence, the change, the risk and the check", () => {
    const { title, body } = opportunityTicket(detail());
    expect(title).toBe("Review query");
    for (const part of [
      "https://example.com/pricing",
      'Query: "software"',
      "Current 28 days: 12 clicks, 640 impressions, CTR 1.88%, average position 8.4",
      "## Proposed change\n\nRewrite the title.",
      "## Risk\n\nPositions are averages. Estimated effort: 2 hours.",
      "## How to verify",
    ])
      expect(body).toContain(part);
  });

  it("uses only the latest run and never a note", () => {
    const { body } = opportunityTicket(detail());
    expect(body).not.toContain("999 clicks");
    expect(body).not.toMatch(/ghp_|secret|admin/);
  });

  it("states the contrast values and the heading outline of a cluster", () => {
    const value = opportunityDetail("approved");
    const evidence = {
      id: "a1",
      opportunityId: value.opportunity.id,
      runId: value.opportunity.evidenceRunId,
      auditId: "audit-1",
      clusterKey: "cluster",
      impact: "serious" as const,
      wcagTags: "wcag2aa wcag143",
      pagesAffected: 4,
      exampleUrl: "https://example.com/",
      exampleSelector: ".hero p",
      exampleSnippet: "<p>",
    };
    value.accessibilityEvidence = [{ ...evidence, ruleId: "color-contrast" }];
    const contrast = opportunityTicket(value, null, {
      summary:
        "Fix any of the following:\n  Element has insufficient color contrast of 2.52 (foreground color: #aaaaaa, background color: #ffffff, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
      headings: [],
    });
    expect(contrast.body).toContain(
      "## Contrast\n\n- Measured ratio: 2.52:1\n- Foreground color: #aaaaaa\n- Background color: #ffffff\n- Required ratio: 4.5:1",
    );
    value.accessibilityEvidence = [{ ...evidence, ruleId: "heading-order" }];
    const outline = opportunityTicket(value, null, {
      summary: null,
      headings: [
        { level: 1, text: "Welcome" },
        { level: 2, text: "Features" },
        { level: 4, text: "Pricing" },
      ],
    });
    expect(outline.body).toContain(
      "- h1 `Welcome`\n- h2 `Features`\n- h4 `Pricing` (skips from h2)",
    );
  });
});
