import { expect, it } from "vitest";
import { checkCopyDraft, type CopyDraftInputs } from "./copyDraftChecks";

// RFC-0012 5.5: one test per dark-pattern rule.
const inputs = (overrides: Partial<CopyDraftInputs> = {}): CopyDraftInputs => ({
  queries: ["acquire saas business"],
  pageTitle: "Acquisitions",
  pageText:
    "We acquire subscription software businesses and keep them running.",
  contextText: "Playbook Media buys software businesses.",
  currentValue: "Share your product",
  blockKind: "button",
  mainQuery: null,
  ...overrides,
});
const check = (text: string, overrides: Partial<CopyDraftInputs> = {}) =>
  checkCopyDraft(
    { text, rationale: "", usedQueries: [], claims: [] },
    inputs(overrides),
  );

it("refuses new numbers and prices", () => {
  expect(check("Get 20% off now")).toEqual(
    expect.arrayContaining([
      expect.stringContaining("numbers are not in the inputs"),
    ]),
  );
});

it("refuses reviews, ratings, logos and awards that the inputs do not state", () => {
  expect(check("Join our award winning team")).toEqual(
    expect.arrayContaining([expect.stringContaining("award")]),
  );
});

it("refuses urgency unless the inputs state the same claim", () => {
  expect(check("Apply today only")).toEqual(
    expect.arrayContaining([expect.stringContaining("today only")]),
  );
  expect(
    check("Apply today only", {
      pageText: "Applications are open today only.",
    }),
  ).toEqual([]);
});

it("refuses an opt-out that shames the visitor", () => {
  expect(
    check("No thanks, I hate saving money", { blockKind: "paragraph" }),
  ).toEqual(
    expect.arrayContaining([
      "Do not write an opt-out that shames the visitor.",
    ]),
  );
});

it("needs a call to action of 2 to 5 words that starts with a verb", () => {
  expect(check("Share your product today")).toEqual([]);
  expect(check("Your product")).toEqual([
    'A call to action has 2 to 5 words and starts with a verb, for example "Book a call".',
  ]);
});

it("keeps the main query's terms that the heading already uses", () => {
  const heading = {
    blockKind: "heading" as const,
    mainQuery: "acquire saas business",
    currentValue: "We acquire SaaS businesses",
  };
  expect(check("We buy software companies", heading)).toEqual([
    "Keep the main query's terms that the heading already uses: acquire, saas.",
  ]);
  expect(check("We acquire SaaS products", heading)).toEqual([]);
});
