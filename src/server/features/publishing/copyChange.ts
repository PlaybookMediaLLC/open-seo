import { AppError } from "@/server/lib/errors";
import type { ProposalTextEdit } from "@/types/schemas/publishing";
import {
  findTextNodes,
  MARKDOWN_MARKUP,
  type TextNodeKind,
} from "./copyLocator";
import { parseSource } from "./metadataSyntax";
import { normalizeText } from "./pageTexts";
import { gitBlobHash } from "./proposalFingerprint";

const lineAt = (source: string, offset: number) => {
  const start = source.lastIndexOf("\n", offset - 1) + 1;
  const end = source.indexOf("\n", offset);
  return source
    .slice(start, end < 0 ? undefined : end)
    .trim()
    .slice(0, 300);
};

function escapeFor(kind: TextNodeKind, quote: string, text: string) {
  if (kind === "string_literal")
    return text.replace(/\\/g, "\\\\").replaceAll(quote, `\\${quote}`);
  if (kind === "template_literal")
    return text
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replaceAll("${", "\\${");
  if (
    (kind === "jsx_text" && /[{}<>]/.test(text)) ||
    (kind === "markdown_text" && MARKDOWN_MARKUP.test(text))
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "The new text contains markup characters. Write plain text.",
    );
  return text;
}

/**
 * RFC-0012 5.4 step 6: replaces the one node that holds `beforeText` with
 * `afterText`, and checks that the file parses again with only that node
 * changed.
 */
function applyTextEdit(
  source: string,
  path: string,
  beforeText: string,
  afterText: string,
) {
  const nodes = findTextNodes(source, path, beforeText);
  if (nodes.length !== 1)
    throw new AppError(
      "VALIDATION_ERROR",
      `The text must appear exactly once in ${path}.`,
    );
  const [node] = nodes;
  const text = normalizeText(afterText);
  if (!text || text.length > 500)
    throw new AppError(
      "VALIDATION_ERROR",
      "Enter new text of 1 to 500 characters.",
    );
  const after =
    source.slice(0, node.start) +
    escapeFor(node.kind, source[node.start - 1] ?? "", text) +
    source.slice(node.end);
  if (
    !findTextNodes(after, path, text).some(
      (edited) => edited.start === node.start && edited.kind === node.kind,
    )
  )
    throw new AppError(
      "VALIDATION_ERROR",
      `${path} did not parse after the edit. Change the text by hand.`,
    );
  return {
    source: after,
    nodeKind: node.kind,
    beforeText: normalizeText(beforeText),
    afterText: text,
    beforeSnippet: lineAt(source, node.start),
    afterSnippet: lineAt(after, node.start),
  };
}

// RFC-0012 5.4: a copy change is at most 5 edits in at most 3 files. Prepare
// and execution build it with this one function, so execution can check that
// it writes exactly what the person approved.
const MAX_EDITS = 5;
const MAX_FILES = 3;
type Wanted = {
  filePath: string;
  beforeText: string;
  afterText: string;
  /** RFC-0013: an opening tag replaced whole, for an attribute fix. */
  nodeKind?: ProposalTextEdit["nodeKind"];
};

/** Replaces one exact opening tag, and checks that the file still parses. */
function applyTagEdit(
  source: string,
  path: string,
  before: string,
  after: string,
) {
  const start = source.indexOf(before);
  if (start < 0 || source.indexOf(before, start + 1) >= 0)
    throw new AppError(
      "VALIDATION_ERROR",
      `The element must appear exactly once in ${path}.`,
    );
  const edited =
    source.slice(0, start) + after + source.slice(start + before.length);
  try {
    parseSource(edited, path);
  } catch {
    throw new AppError(
      "VALIDATION_ERROR",
      `${path} did not parse after the edit. Change the element by hand.`,
    );
  }
  return {
    source: edited,
    nodeKind: "jsx_attribute" as const,
    beforeText: before,
    afterText: after,
    beforeSnippet: lineAt(source, start),
    afterSnippet: lineAt(edited, start),
  };
}

export async function applyCopyEdits(
  sources: Map<string, { source: string; blobSha: string }>,
  wanted: Wanted[],
) {
  if (
    wanted.length > MAX_EDITS ||
    new Set(wanted.map((edit) => edit.filePath)).size > MAX_FILES
  )
    throw new AppError(
      "VALIDATION_ERROR",
      `A page text change holds at most ${MAX_EDITS} edits in ${MAX_FILES} files.`,
    );
  const after = new Map<string, string>();
  const applied = wanted.map((edit) => {
    const current =
      after.get(edit.filePath) ?? sources.get(edit.filePath)?.source;
    if (current === undefined) throw new AppError("CONFLICT");
    const result =
      edit.nodeKind === "jsx_attribute"
        ? applyTagEdit(current, edit.filePath, edit.beforeText, edit.afterText)
        : applyTextEdit(
            current,
            edit.filePath,
            edit.beforeText,
            edit.afterText,
          );
    after.set(edit.filePath, result.source);
    return { filePath: edit.filePath, result };
  });
  const files = await Promise.all(
    [...after].map(async ([path, source]) => ({
      path,
      source,
      blobSha: await gitBlobHash(source),
    })),
  );
  const blobOf = (path: string) =>
    files.find((file) => file.path === path)?.blobSha ?? "";
  const textEdits: ProposalTextEdit[] = applied.map(
    ({ filePath, result }, ordinal) => ({
      ordinal,
      filePath,
      nodeKind: result.nodeKind,
      beforeBlobSha: sources.get(filePath)?.blobSha ?? "",
      afterBlobSha: blobOf(filePath),
      beforeText: result.beforeText,
      afterText: result.afterText,
      beforeSnippet: result.beforeSnippet,
      afterSnippet: result.afterSnippet,
    }),
  );
  return { files, textEdits };
}
