import { expect, it } from "vitest";
import { accessibilityStatement } from "./accessibilityStatement";

// RFC-0013 5.7: stored facts only, and never a compliance claim.
it("lists the open issues as known limitations, from stored facts only", () => {
  const facts = {
    site: "https://example.com/",
    checkedAt: "2026-10-12T08:00:00.000Z",
    pagesChecked: 24,
    rules: [{ ruleId: "image-alt", impact: "critical" as const, pages: 3 }],
  };
  const text = accessibilityStatement(facts, "");
  expect(text).toContain(
    "- Images without alternative text: 3 pages (critical)",
  );
  expect(text).toContain("tested 24 pages");
  expect(text).toContain("contact us at [contact address].");
  expect(text).not.toMatch(/complian|conform/i);
});
