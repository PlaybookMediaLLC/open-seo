import { sortBy } from "remeda";
import { AppError } from "@/server/lib/errors";
import { normalizeText } from "./pageTexts";
import { parseSource, walk, type Program } from "./metadataSyntax";

// RFC-0012 5.4: find the one source node that holds a text from the live
// page. The walk starts at the page file and follows static imports inside
// the repository to depth 2. Parsing reads syntax only; nothing executes.
// RFC-0013, RFC-0014 and RFC-0017 reuse these reading rules.
const MAX_FILES = 20;
const MAX_BYTES = 1024 * 1024;
const MAX_DEPTH = 2;
const MAX_SHARING_PAGES = 30;
const CODE = /\.(?:tsx?|jsx?)$/;
const MARKDOWN = /\.mdx?$/;
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".mdx"];
const PAGE_FILE = /(?:^|\/)page\.(?:tsx|ts|jsx|js)$/;
// A Markdown line's prefix: a heading, list or quote marker.
const MARKDOWN_PREFIX = /^(\s*(?:#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s+)?)(.*?)\s*$/;
export const MARKDOWN_MARKUP = /[*_`[\]()<>{}]/;

export type TextNodeKind =
  | "string_literal"
  | "template_literal"
  | "jsx_text"
  | "markdown_text";
/** The text's own range: no quotes, and no surrounding whitespace. */
type TextNode = {
  kind: TextNodeKind;
  start: number;
  end: number;
  line: number;
  /** The top-level export that holds the node, when there is one. */
  exportName: string | null;
};
type Reader = {
  readFile(
    path: string,
    sha: string,
  ): Promise<{ source: string; blobSha: string }>;
};
export type SourceFile = { path: string; source: string; blobSha: string };

const lineOf = (source: string, offset: number) =>
  source.slice(0, offset).split("\n").length;
const range = (value: unknown) => {
  const start: unknown = Reflect.get(Object(value), "start");
  const end: unknown = Reflect.get(Object(value), "end");
  return typeof start === "number" && typeof end === "number"
    ? { start, end }
    : null;
};

function exportNameAt(program: Program, offset: number) {
  for (const statement of program.body) {
    const span = range(statement);
    if (!span || offset < span.start || offset >= span.end) continue;
    if (statement.type === "ExportDefaultDeclaration") return "default";
    if (statement.type !== "ExportNamedDeclaration") return null;
    const declaration = statement.declaration;
    if (declaration?.type === "VariableDeclaration") {
      const [first] = declaration.declarations;
      return first?.id.type === "Identifier" ? first.id.name : null;
    }
    return (declaration?.type === "FunctionDeclaration" ||
      declaration?.type === "ClassDeclaration") &&
      declaration.id
      ? declaration.id.name
      : null;
  }
  return null;
}

/** Nodes whose whitespace-normalized text equals `text`, in one file. */
export function findTextNodes(
  source: string,
  path: string,
  text: string,
): TextNode[] {
  const wanted = normalizeText(text);
  if (MARKDOWN.test(path)) {
    const nodes: TextNode[] = [];
    let offset = 0;
    for (const [index, line] of source.split("\n").entries()) {
      const [, prefix = "", body = ""] = MARKDOWN_PREFIX.exec(line) ?? [];
      if (
        normalizeText(body) === wanted &&
        !MARKDOWN_MARKUP.test(body) &&
        !line.trimStart().startsWith("import ")
      )
        nodes.push({
          kind: "markdown_text",
          start: offset + prefix.length,
          end: offset + prefix.length + body.length,
          line: index + 1,
          exportName: null,
        });
      offset += line.length + 1;
    }
    return nodes;
  }
  // JSON parses as one parenthesized expression.
  const json = path.endsWith(".json");
  const shift = json ? 1 : 0;
  let program: Program;
  try {
    program = json
      ? parseSource(`(${source})`, "data.ts")
      : parseSource(source, path);
  } catch {
    return [];
  }
  const nodes: TextNode[] = [];
  const add = (kind: TextNodeKind, start: number, end: number) =>
    nodes.push({
      kind,
      start: start - shift,
      end: end - shift,
      line: lineOf(source, start - shift),
      exportName: json ? null : exportNameAt(program, start - shift),
    });
  walk(program, (node) => {
    const span = range(node);
    if (!span) return;
    if (
      node.type === "StringLiteral" &&
      typeof node.value === "string" &&
      normalizeText(node.value) === wanted
    )
      add("string_literal", span.start + 1, span.end - 1);
    if (node.type === "TemplateLiteral") {
      const expressions: unknown = node.expressions;
      const quasis: unknown = node.quasis;
      const [quasi] = Array.isArray(quasis) ? (quasis as unknown[]) : [];
      const cooked: unknown =
        quasi &&
        Reflect.get(Object(Reflect.get(Object(quasi), "value")), "cooked");
      if (
        Array.isArray(expressions) &&
        expressions.length === 0 &&
        typeof cooked === "string" &&
        normalizeText(cooked) === wanted
      )
        add("template_literal", span.start + 1, span.end - 1);
    }
    if (
      node.type === "JSXText" &&
      typeof node.value === "string" &&
      normalizeText(node.value) === wanted
    ) {
      const raw = node.value;
      const leading = raw.length - raw.trimStart().length;
      const trailing = raw.length - raw.trimEnd().length;
      add("jsx_text", span.start + leading, span.end - trailing);
    }
  });
  return sortBy(nodes, (node) => node.start);
}

type ImportOf = { specifier: string; names: string[] | "all" };

/** Static imports and re-exports inside the repository. Type-only ones are left out. */
function localImports(source: string, path: string): ImportOf[] {
  let program: Program;
  try {
    program = parseSource(source, path);
  } catch {
    return [];
  }
  const imports: ImportOf[] = [];
  for (const statement of program.body) {
    if (
      (statement.type !== "ImportDeclaration" &&
        statement.type !== "ExportNamedDeclaration" &&
        statement.type !== "ExportAllDeclaration") ||
      !statement.source ||
      ("importKind" in statement && statement.importKind === "type") ||
      ("exportKind" in statement && statement.exportKind === "type")
    )
      continue;
    const specifier = statement.source.value;
    if (!/^(?:\.{1,2}\/|@\/)/.test(specifier)) continue;
    const names: string[] | "all" =
      statement.type === "ImportDeclaration" &&
      statement.specifiers.every(
        (item) =>
          item.type === "ImportSpecifier" ||
          item.type === "ImportDefaultSpecifier",
      )
        ? statement.specifiers.map((item) =>
            item.type === "ImportDefaultSpecifier"
              ? "default"
              : item.type === "ImportSpecifier"
                ? item.imported.type === "Identifier"
                  ? item.imported.name
                  : item.imported.value
                : "",
          )
        : "all";
    imports.push({ specifier, names });
  }
  return imports;
}

/** The repository paths an import may name, in the order a bundler tries them. */
function importCandidates(
  fromPath: string,
  specifier: string,
  rootDirectory: string,
) {
  const base = specifier.startsWith("@/")
    ? [rootDirectory, specifier.slice(2)].filter(Boolean).join("/")
    : [...fromPath.split("/").slice(0, -1), specifier].join("/");
  const parts: string[] = [];
  for (const part of base.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return [];
      parts.pop();
    } else parts.push(part);
  }
  const path = parts.join("/");
  if (EXTENSIONS.some((extension) => path.endsWith(extension))) return [path];
  return [
    ...EXTENSIONS.map((extension) => `${path}${extension}`),
    ...[".ts", ".tsx", ".js", ".jsx"].map(
      (extension) => `${path}/index${extension}`,
    ),
  ];
}

async function readFirst(reader: Reader, paths: string[], sha: string) {
  for (const path of paths) {
    try {
      return { path, ...(await reader.readFile(path, sha)) };
    } catch (error) {
      // A missing candidate is expected, and a file over the read limit is
      // skipped. A spent request budget still stops the walk.
      if (
        error instanceof AppError &&
        ["NOT_FOUND", "VALIDATION_ERROR", "UPSTREAM_UNAVAILABLE"].includes(
          error.code,
        )
      )
        continue;
      throw error;
    }
  }
  return null;
}

type LocateCopyResult =
  | { status: "found"; file: SourceFile; node: TextNode; filesRead: string[] }
  | {
      status: "not_found" | "ambiguous";
      matches: Array<{ path: string; line: number }>;
      filesRead: string[];
      message: string;
    };

/**
 * The page file and the files it imports inside the repository, to depth 2,
 * at most 20 files and 1 MB. Null when the page file cannot be read.
 */
export async function reachableFiles(input: {
  reader: Reader;
  rootDirectory: string;
  pageFile: string;
  sha: string;
}): Promise<SourceFile[] | null> {
  const { reader, sha } = input;
  const page = await readFirst(reader, [input.pageFile], sha);
  if (!page) return null;
  const queue: Array<SourceFile & { depth: number }> = [{ ...page, depth: 0 }];
  const seen = new Set([page.path]);
  const files: SourceFile[] = [];
  let bytes = 0;
  while (files.length < MAX_FILES) {
    const entry = queue.shift();
    if (!entry) break;
    const { depth, ...file } = entry;
    bytes += new TextEncoder().encode(file.source).byteLength;
    if (bytes > MAX_BYTES) break;
    files.push(file);
    if (depth >= MAX_DEPTH || !CODE.test(file.path)) continue;
    for (const { specifier } of localImports(file.source, file.path)) {
      if (files.length + queue.length >= MAX_FILES) break;
      const candidates = importCandidates(
        file.path,
        specifier,
        input.rootDirectory,
      ).filter((path) => !seen.has(path));
      const next = await readFirst(reader, candidates, sha);
      if (!next) continue;
      seen.add(next.path);
      queue.push({ ...next, depth: depth + 1 });
    }
  }
  return files;
}

export async function locateCopy(input: {
  reader: Reader;
  rootDirectory: string;
  pageFile: string;
  sha: string;
  text: string;
}): Promise<LocateCopyResult> {
  const files = await reachableFiles(input);
  if (!files)
    return {
      status: "not_found",
      matches: [],
      filesRead: [],
      message: `${input.pageFile} could not be read.`,
    };
  const found = files.flatMap((file) =>
    findTextNodes(file.source, file.path, input.text).map((node) => ({
      file,
      node,
    })),
  );
  const filesRead = files.map((file) => file.path);
  const matches = found.map(({ file, node }) => ({
    path: file.path,
    line: node.line,
  }));
  if (found.length === 1) return { status: "found", ...found[0], filesRead };
  return found.length
    ? {
        status: "ambiguous",
        matches,
        filesRead,
        message: `The text appears ${found.length} times. Relay changes one place only; change it by hand.`,
      }
    : {
        status: "not_found",
        matches,
        filesRead,
        message:
          "No single plain-text node holds this text. It may be split across nodes, contain markup, or be computed. Change it by hand.",
      };
}

/**
 * RFC-0012 5.4 step 5: the other App Router pages that import the module
 * that holds the text, and the name that holds it.
 */
export async function pagesSharing(input: {
  reader: Reader & {
    listFiles(
      path: string,
      sha: string,
    ): Promise<{ paths: string[]; truncated: boolean }>;
  };
  rootDirectory: string;
  sha: string;
  pageFile: string;
  modulePath: string;
  exportName: string | null;
}) {
  if (input.modulePath === input.pageFile) return { pages: [], complete: true };
  const appIndex = input.pageFile.lastIndexOf("app/");
  const appDirectory = input.pageFile.slice(0, appIndex + 3);
  const listed = await input.reader.listFiles(appDirectory, input.sha);
  const pages = listed.paths
    .filter((path) => PAGE_FILE.test(path) && path !== input.pageFile)
    .slice(0, MAX_SHARING_PAGES);
  const sharing: string[] = [];
  for (const path of pages) {
    const file = await readFirst(input.reader, [path], input.sha);
    if (!file) continue;
    const uses = localImports(file.source, path).some(
      ({ specifier, names }) =>
        importCandidates(path, specifier, input.rootDirectory).includes(
          input.modulePath,
        ) &&
        (names === "all" ||
          input.exportName === null ||
          names.includes(input.exportName)),
    );
    if (uses) sharing.push(path);
  }
  return {
    pages: sharing,
    complete:
      !listed.truncated &&
      listed.paths.filter((path) => PAGE_FILE.test(path)).length <=
        MAX_SHARING_PAGES + 1,
  };
}
