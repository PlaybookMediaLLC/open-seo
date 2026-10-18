import {
  checkDraft,
  type DraftInputs,
  type DraftOutput,
} from "@/server/features/publishing/draftChecks";

// RFC-0012 5.5: the deterministic checks every conversion copy draft passes
// before a person sees it. They run after the RFC-0004 checks for numbers,
// quotes, claims and queries.
const LENGTH = {
  heading: { label: "heading", min: 3, max: 90 },
  button: { label: "call to action", min: 2, max: 40 },
  link: { label: "call to action", min: 2, max: 40 },
  label: { label: "form label", min: 2, max: 60 },
  paragraph: { label: "paragraph", min: 20, max: 300 },
} as const;
// Social proof a draft must not invent: reviews, ratings, logos, awards and
// customer names come from the owner's own words only.
const PROOF = [
  "review",
  "reviews",
  "rated",
  "rating",
  "stars",
  "★",
  "award",
  "awards",
  "trusted by",
  "used by",
  "as seen in",
  "featured in",
  "customers like",
  "testimonial",
];
const URGENCY = [
  "only",
  "last chance",
  "ends today",
  "ends soon",
  "spots left",
  "seats left",
  "few left",
  "hurry",
  "limited time",
  "today only",
  "act now",
  "don't miss",
  "do not miss",
  "while supplies last",
  "selling fast",
  "before it's gone",
];
// "No thanks, I hate saving money": an opt-out that shames the visitor.
const SHAMING =
  /\bno,?\s+thanks?\b.*\bi\b|\bi\s+(?:don'?t|do not)\s+(?:want|like|care|need)\b|\bi\s+(?:hate|prefer to (?:lose|pay|miss))\b/i;
// ponytail: a fixed list of call-to-action verbs; a part-of-speech tagger
// would accept more labels if owners need them.
const CTA_VERBS = new Set(
  "start get book try see talk request join download create contact schedule learn explore compare buy sign subscribe claim discover find read watch build send apply register upgrade choose view check ask call chat begin open access launch plan shop order reserve save unlock meet hire grow sell add make go show estimate calculate share submit tell introduce discuss review test connect enquire inquire speak visit follow".split(
    " ",
  ),
);
const STOP_WORDS = new Set(
  "a an and are as at be by for from how in is it of on or the to what when where who why with your you".split(
    " ",
  ),
);

export type CopyBlockKind = keyof typeof LENGTH;
export type CopyDraftInputs = DraftInputs & {
  blockKind: CopyBlockKind;
  /** The page's main search query, when it ranks for one. */
  mainQuery: string | null;
};

const normalize = (text: string) =>
  text.toLowerCase().replace(/\s+/g, " ").trim();
const has = (text: string, phrase: string) =>
  new RegExp(
    `(?<![\\p{L}\\p{N}])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`,
    "u",
  ).test(normalize(text));

/** The failed checks, in order. An empty list means the draft passed. */
export function checkCopyDraft(
  output: DraftOutput,
  inputs: CopyDraftInputs,
): string[] {
  const draft = output.text.trim();
  const failures = checkDraft(output, inputs, LENGTH[inputs.blockKind]);
  const sources = [
    inputs.pageTitle,
    inputs.pageText,
    inputs.contextText,
    inputs.currentValue ?? "",
  ].join("\n");
  const proof = PROOF.filter(
    (phrase) => has(draft, phrase) && !has(sources, phrase),
  );
  if (proof.length)
    failures.push(
      `Do not add reviews, ratings, logos, awards or customer names: ${proof.join(", ")}.`,
    );
  const urgency = URGENCY.filter(
    (phrase) => has(draft, phrase) && !has(sources, phrase),
  );
  if (urgency.length)
    failures.push(
      `Do not add urgency or scarcity that the inputs do not state: ${urgency.join(", ")}.`,
    );
  if (SHAMING.test(draft))
    failures.push("Do not write an opt-out that shames the visitor.");
  if (inputs.blockKind === "button" || inputs.blockKind === "link") {
    const words = draft.split(/\s+/);
    if (
      words.length < 2 ||
      words.length > 5 ||
      !CTA_VERBS.has(words[0].toLowerCase().replace(/[^a-z]/g, ""))
    )
      failures.push(
        'A call to action has 2 to 5 words and starts with a verb, for example "Book a call".',
      );
  }
  if (inputs.blockKind === "heading" && inputs.mainQuery) {
    const kept = normalize(inputs.mainQuery)
      .split(" ")
      .filter(
        (term) =>
          term.length > 2 &&
          !STOP_WORDS.has(term) &&
          has(inputs.currentValue ?? "", term),
      )
      .filter((term) => !has(draft, term));
    if (kept.length)
      failures.push(
        `Keep the main query's terms that the heading already uses: ${kept.join(", ")}.`,
      );
  }
  return failures;
}
