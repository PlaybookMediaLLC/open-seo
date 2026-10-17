import { z } from "zod";

// RFC-0004 5.3: deterministic checks that every model draft passes before a
// person sees it. A failing draft is retried once, then rejected.
export const LENGTH_RULES = {
  meta_description: { label: "description", min: 70, max: 160 },
  // The final title, with the layout's title template (RFC-0005).
  meta_title: { label: "title", min: 30, max: 60 },
} as const;
export type LengthRule = { label: string; min: number; max: number };
// Claims that need the owner's own words before a draft may use them.
const RISKY_PHRASES = [
  "best",
  "#1",
  "number one",
  "no. 1",
  "leading",
  "top-rated",
  "top rated",
  "award-winning",
  "guaranteed",
  "guarantee",
  "cheapest",
  "fastest",
  "world-class",
  "risk-free",
  "100%",
];

export const draftOutputSchema = z.object({
  text: z.string().min(1).max(320),
  rationale: z.string().max(500),
  usedQueries: z.array(z.string()).max(5),
  claims: z
    .array(
      z.object({
        text: z.string().max(300),
        sourceKind: z.enum(["page", "context", "query"]),
        quote: z.string().max(300),
      }),
    )
    .max(5),
});
export type DraftOutput = z.infer<typeof draftOutputSchema>;

export type DraftInputs = {
  queries: string[];
  pageTitle: string;
  pageText: string;
  contextText: string;
  currentValue: string | null;
};

const normalize = (text: string) =>
  text.toLowerCase().replace(/\s+/g, " ").trim();

function containsPhrase(text: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
    "u",
  ).test(normalize(text));
}

/** The failed checks, in order. An empty list means the draft passed. */
export function checkDraft(
  output: DraftOutput,
  inputs: DraftInputs,
  rule: LengthRule = LENGTH_RULES.meta_description,
): string[] {
  const draft = output.text.trim();
  const sources = {
    page: `${inputs.pageTitle}\n${inputs.pageText}`,
    context: inputs.contextText,
    query: inputs.queries.join("\n"),
  };
  const everything = [
    sources.page,
    sources.context,
    sources.query,
    inputs.currentValue ?? "",
  ].join("\n");
  const failures: string[] = [];
  if (draft.length < rule.min || draft.length > rule.max)
    failures.push(
      `The ${rule.label} has ${draft.length} characters. Use ${rule.min} to ${rule.max}.`,
    );
  if (/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(output.text))
    failures.push(`The ${rule.label} contains a control or format character.`);
  if (
    inputs.currentValue !== null &&
    normalize(draft) === normalize(inputs.currentValue)
  )
    failures.push(`The ${rule.label} is the same as the current one.`);
  const numbers = draft.match(/\d+(?:[.,]\d+)*/g) ?? [];
  const missingNumbers = numbers.filter(
    (number) => !containsPhrase(everything, number),
  );
  if (missingNumbers.length)
    failures.push(
      `These numbers are not in the inputs: ${missingNumbers.join(", ")}.`,
    );
  const unsupported = output.claims.filter(
    (claim) =>
      !normalize(sources[claim.sourceKind]).includes(normalize(claim.quote)),
  );
  if (unsupported.length)
    failures.push(
      `These claims have no exact quote in their source: ${unsupported.map((claim) => claim.text).join("; ")}.`,
    );
  // Page text is untrusted and queries are what searchers type, so only the
  // owner's own words (context and current metadata) can support a claim
  // like "best" or "#1".
  const trusted = `${inputs.contextText}\n${inputs.currentValue ?? ""}`;
  const risky = RISKY_PHRASES.filter(
    (phrase) =>
      containsPhrase(draft, phrase) && !containsPhrase(trusted, phrase),
  );
  if (risky.length)
    failures.push(`Remove these unsupported claims: ${risky.join(", ")}.`);
  const queries = new Set(inputs.queries.map(normalize));
  const unknown = output.usedQueries.filter(
    (query) => !queries.has(normalize(query)),
  );
  if (unknown.length)
    failures.push(
      `These used queries are not input queries: ${unknown.join(", ")}.`,
    );
  return failures;
}

/**
 * The checks for model text that may only restate its source, such as an
 * investigation summary. An empty list means the text passed.
 */
export function checkGroundedText(
  text: string,
  source: string,
  max: number,
): string[] {
  const trimmed = text.trim();
  const failures: string[] = [];
  if (!trimmed.length || trimmed.length > max)
    failures.push(
      `The text has ${trimmed.length} characters. Use 1 to ${max}.`,
    );
  if (/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(text))
    failures.push("The text contains a control or format character.");
  const missing = (trimmed.match(/\d+(?:[.,]\d+)*/g) ?? []).filter(
    (number) => !containsPhrase(source, number),
  );
  if (missing.length)
    failures.push(
      `These numbers are not in the source: ${missing.join(", ")}.`,
    );
  const risky = RISKY_PHRASES.filter(
    (phrase) =>
      containsPhrase(trimmed, phrase) && !containsPhrase(source, phrase),
  );
  if (risky.length)
    failures.push(`Remove these unsupported claims: ${risky.join(", ")}.`);
  return failures;
}

export const anchorOutputSchema = z.object({
  anchor: z.string().min(1).max(120),
  sentence: z.string().min(1).max(500),
  rationale: z.string().max(500),
});
type AnchorOutput = z.infer<typeof anchorOutputSchema>;

/**
 * An internal-link anchor must be words that already stand in one sentence
 * of the source page, so the link reads naturally where it is added.
 */
export function checkAnchor(output: AnchorOutput, pageText: string): string[] {
  const anchor = output.anchor.trim();
  const failures: string[] = [];
  const words = anchor.split(/\s+/).length;
  if (anchor.length < 2 || anchor.length > 80 || words > 8)
    failures.push("Use an anchor of 2 to 80 characters and at most 8 words.");
  if (/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(`${output.anchor}${output.sentence}`))
    failures.push(
      "The anchor or sentence contains a control or format character.",
    );
  if (!normalize(pageText).includes(normalize(output.sentence)))
    failures.push("The sentence is not on the source page. Copy it exactly.");
  if (!containsPhrase(output.sentence, anchor))
    failures.push("The anchor is not in the sentence. Copy it exactly.");
  return failures;
}
