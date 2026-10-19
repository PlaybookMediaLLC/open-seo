import { z } from "zod";
import { parseDoc } from "./docsMarkdown";
import { markdownOnly, PLACEHOLDER } from "./markdownEdit";

// RFC-0017 5.6: checks for a docs draft. Every fact quotes a source, code is
// copied from a source, and a missing fact is a visible placeholder.
export const DOCS_DRAFT_MAX = 4_000;
export const docsDraftOutputSchema = z.object({
  text: z.string().min(1).max(DOCS_DRAFT_MAX),
  rationale: z.string().max(500),
  usedQueries: z.array(z.string()).max(5),
  claims: z
    .array(
      z.object({
        text: z.string().max(300),
        sourceKind: z.enum(["page", "context"]),
        quote: z.string().max(300),
      }),
    )
    .max(10),
});
type DocsDraft = z.infer<typeof docsDraftOutputSchema>;

const normalize = (text: string) =>
  text.toLowerCase().replace(/\s+/g, " ").trim();
const PLACEHOLDERS = new RegExp(PLACEHOLDER.source, "gi");

/** The text without its placeholders, for the number and claim checks. */
export const withoutPlaceholders = (text: string) =>
  text.replace(PLACEHOLDERS, "");

/** The failed checks. An empty list means the draft passed. */
export function checkDocsDraft(
  output: DocsDraft,
  sources: { docs: string; owner: string },
) {
  const failures: string[] = [];
  const everything = `${sources.docs}\n${sources.owner}`;
  try {
    if (!markdownOnly(parseDoc(output.text, true).tree))
      failures.push("Write Markdown only, without JSX, imports or HTML.");
  } catch {
    failures.push("The draft is not valid Markdown.");
  }
  const code = [
    ...output.text.matchAll(/```[^\n]*\n([\s\S]*?)```|`([^`\n]+)`/g),
  ].map((match) => (match[1] ?? match[2] ?? "").trim());
  const invented = code.filter(
    (snippet) => snippet && !everything.includes(snippet),
  );
  if (invented.length)
    failures.push(
      `This code is not in the sources: ${invented.join("; ").slice(0, 300)}. Use a placeholder instead.`,
    );
  const unsupported = output.claims.filter(
    (claim) =>
      !normalize(
        claim.sourceKind === "page" ? sources.docs : sources.owner,
      ).includes(normalize(claim.quote)),
  );
  if (unsupported.length)
    failures.push(
      `These claims have no exact quote in their source: ${unsupported.map((claim) => claim.text).join("; ")}.`,
    );
  return failures;
}
