import { MarkdownEditPreview } from "@/client/features/docs/MarkdownEditPreview";
import type { ProposalWithHistory } from "@/types/schemas/publishing";

/** The before and after of every changed field and text edit. */
export function ProposalDiffs({
  proposal,
  textEdits,
}: Pick<ProposalWithHistory, "proposal" | "textEdits">) {
  return (
    <>
      {(
        [
          proposal.titleAfter !== null && [
            "Title",
            proposal.titleBeforeSnippet,
            proposal.titleAfterSnippet,
          ],
          proposal.descriptionAfter !== proposal.descriptionBefore && [
            "Description",
            proposal.beforeSnippet,
            proposal.afterSnippet,
          ],
          proposal.canonicalAfter !== null && [
            "Canonical URL",
            proposal.canonicalBeforeSnippet,
            proposal.canonicalAfterSnippet,
          ],
          proposal.robotsAfter !== null && [
            "Robots",
            proposal.robotsBeforeSnippet,
            proposal.robotsAfterSnippet,
          ],
          // RFC-0012 5.4: each page text edit, with its file.
          ...textEdits.map(
            (edit) =>
              [
                `Text ${edit.ordinal + 1} in ${edit.filePath}`,
                // RFC-0017 5.5: a docs edit shows its whole Markdown block.
                edit.nodeKind === "markdown_block"
                  ? edit.beforeText
                  : edit.beforeSnippet,
                edit.nodeKind === "markdown_block"
                  ? edit.afterText
                  : edit.afterSnippet,
              ] as const,
          ),
        ] as const
      )
        .filter((diff) => diff !== false)
        .map(([field, before, after]) => (
          <div key={field} className="grid gap-3 lg:grid-cols-2">
            <div className="min-w-0 rounded-lg border border-red-500/20 bg-red-500/5">
              <p className="border-b border-red-500/20 px-3 py-2 text-xs font-medium">
                − {field} before
              </p>
              <pre className="overflow-auto p-3 text-xs whitespace-pre-wrap break-words">
                <code>{before}</code>
              </pre>
            </div>
            <div className="min-w-0 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
              <p className="border-b border-emerald-500/20 px-3 py-2 text-xs font-medium">
                + {field} after
              </p>
              <pre className="overflow-auto p-3 text-xs whitespace-pre-wrap break-words">
                <code>{after}</code>
              </pre>
            </div>
          </div>
        ))}
      {proposal.changeKind === "markdown" && (
        <MarkdownEditPreview edits={textEdits} />
      )}
    </>
  );
}
