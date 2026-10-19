import { expect, it } from "vitest";
import { checkDocsDraft } from "./docsDraft";

// RFC-0017 5.6: facts quote a source, code is copied, gaps are placeholders.
const sources = {
  docs: "Run `npx skills list` to see installed skills.",
  owner: "Skills update every week.",
};
const draft = (text: string, quote = "Skills update every week.") => ({
  text,
  rationale: "",
  usedQueries: [],
  claims: [{ text: "Weekly updates", sourceKind: "context" as const, quote }],
});

it("accepts copied code and a placeholder for a missing command", () => {
  expect(
    checkDocsDraft(
      draft(
        "## Update skills\n\nRun `npx skills list`. Then run [Owner: add the update command].",
      ),
      sources,
    ),
  ).toEqual([]);
});

it("rejects invented code, an unquoted claim and JSX", () => {
  expect(
    checkDocsDraft(
      draft(
        "## Update\n\nRun `npx skills upgrade`.\n\n<Steps />",
        "Daily updates.",
      ),
      sources,
    ),
  ).toEqual([
    "Write Markdown only, without JSX, imports or HTML.",
    "This code is not in the sources: npx skills upgrade. Use a placeholder instead.",
    "These claims have no exact quote in their source: Weekly updates.",
  ]);
});
