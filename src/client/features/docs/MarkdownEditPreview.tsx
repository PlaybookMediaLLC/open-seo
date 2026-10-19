import { Markdown } from "@/client/components/Markdown";
import type { ProposalTextEdit } from "@/types/schemas/publishing";

/** RFC-0017 5.5: the rendered Markdown before and after each docs edit. */
export function MarkdownEditPreview({ edits }: { edits: ProposalTextEdit[] }) {
  return edits.map((edit) => (
    <div key={edit.ordinal} className="grid gap-3 lg:grid-cols-2">
      {(
        [
          ["Rendered before", edit.beforeText],
          ["Rendered after", edit.afterText],
        ] as const
      ).map(([label, text]) => (
        <section
          key={label}
          aria-label={label}
          className="min-w-0 rounded-lg border p-3 text-sm"
        >
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {label}
          </p>
          <Markdown className="space-y-2">{text}</Markdown>
        </section>
      ))}
    </div>
  ));
}
