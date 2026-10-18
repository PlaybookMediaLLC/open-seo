import { AppError } from "@/server/lib/errors";
import { reachableFiles, type SourceFile } from "./copyLocator";
import { parseSource, walk, type Program } from "./metadataSyntax";

// RFC-0013 5.4: find the one JSX element that an accessibility fix changes,
// and set one attribute on it. RFC-0014 reuses this change kind. Parsing
// reads syntax only; nothing executes.
export type ElementTarget = { kind: "image"; src: string } | { kind: "html" };
type Range = { start: number; end: number };
type Found = { file: SourceFile; element: Range; line: number };
type Reader = Parameters<typeof reachableFiles>[0]["reader"];

const rangeOf = (value: unknown): Range | null => {
  const start: unknown = value && Reflect.get(Object(value), "start");
  const end: unknown = value && Reflect.get(Object(value), "end");
  return typeof start === "number" && typeof end === "number"
    ? { start, end }
    : null;
};
const field = (value: unknown, key: string): unknown =>
  value && typeof value === "object" ? Reflect.get(value, key) : undefined;
const list = (value: unknown): unknown[] =>
  Array.isArray(value) ? (value as unknown[]) : [];
const baseName = (path: string) => path.split("/").at(-1) ?? path;

/**
 * The image file name behind a rendered src: a plain path, Next.js image
 * optimization (`/_next/image?url=…`), or a hashed static import
 * (`/_next/static/media/hero.3f2a1b.png`).
 */
export function imageFileName(src: string) {
  let path = src;
  try {
    const url = new URL(src, "https://site.invalid");
    path =
      url.pathname === "/_next/image"
        ? new URL(url.searchParams.get("url") ?? "", "https://site.invalid")
            .pathname
        : url.pathname;
  } catch {
    return null;
  }
  const name = baseName(path);
  return path.includes("/_next/static/media/")
    ? name.replace(/\.[0-9a-f]{6,}(\.[a-z0-9]+)$/i, "$1")
    : name;
}

/** Local names of default imports from image files, by file name. */
function imageImports(program: Program) {
  const names = new Map<string, string>();
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration") continue;
    const file = baseName(statement.source.value);
    if (!/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(file)) continue;
    for (const specifier of statement.specifiers)
      if (specifier.type === "ImportDefaultSpecifier")
        names.set(specifier.local.name, file);
  }
  return names;
}

function matches(
  node: Record<string, unknown>,
  target: ElementTarget,
  imports: Map<string, string>,
) {
  const name: unknown = field(field(node, "name"), "name");
  if (target.kind === "html") return name === "html";
  if (name !== "img" && name !== "Image") return false;
  const src = list(field(node, "attributes")).find(
    (attribute) =>
      field(attribute, "type") === "JSXAttribute" &&
      field(field(attribute, "name"), "name") === "src",
  );
  const value = field(src, "value");
  const wanted = imageFileName(target.src);
  if (field(value, "type") === "StringLiteral") {
    const literal = String(field(value, "value"));
    return (
      literal === target.src ||
      (wanted !== null && imageFileName(literal) === wanted)
    );
  }
  const expression = field(value, "expression");
  return (
    field(expression, "type") === "Identifier" &&
    wanted !== null &&
    imports.get(String(field(expression, "name"))) === wanted
  );
}

export async function locateElement(input: {
  reader: Reader;
  rootDirectory: string;
  pageFile: string;
  sha: string;
  target: ElementTarget;
}) {
  const files = (await reachableFiles(input)) ?? [];
  const found: Found[] = [];
  for (const file of files) {
    if (!/\.(tsx|jsx)$/.test(file.path)) continue;
    let program: Program;
    try {
      program = parseSource(file.source, file.path);
    } catch {
      continue;
    }
    const imports = imageImports(program);
    walk(program, (node) => {
      const element = rangeOf(node);
      if (
        node.type === "JSXOpeningElement" &&
        element &&
        matches(node, input.target, imports)
      )
        found.push({
          file,
          element,
          line: file.source.slice(0, element.start).split("\n").length,
        });
    });
  }
  return { found, filesRead: files.map((file) => file.path) };
}

const attributeValue = (value: string) =>
  /["{}]/.test(value) ? `{${JSON.stringify(value)}}` : `"${value}"`;

/**
 * The opening tag with `name` set to `value`. A new attribute goes last, so
 * no spread can override it; an existing one followed by a spread is refused.
 */
export function withAttribute(
  file: SourceFile,
  element: Range,
  name: string,
  value: string,
) {
  const tag = file.source.slice(element.start, element.end);
  // The tag alone, closed so it parses; the "(" shifts offsets by one.
  const tagName = /^<([A-Za-z][\w.:-]*)/.exec(tag)?.[1] ?? "x";
  const program = parseSource(
    tag.endsWith("/>") ? `(${tag})` : `(${tag}</${tagName}>)`,
    "tag.tsx",
  );
  let opening: Record<string, unknown> | null = null;
  walk(program, (node) => {
    if (node.type === "JSXOpeningElement" && !opening) opening = node;
  });
  const attributes = list(field(opening, "attributes"));
  const index = attributes.findIndex(
    (attribute) =>
      field(attribute, "type") === "JSXAttribute" &&
      field(field(attribute, "name"), "name") === name,
  );
  const shift = 1;
  if (index >= 0) {
    if (
      attributes
        .slice(index + 1)
        .some((attribute) => field(attribute, "type") === "JSXSpreadAttribute")
    )
      throw new AppError(
        "VALIDATION_ERROR",
        `A spread after ${name} can override it. Change this element by hand.`,
      );
    const span = rangeOf(attributes[index]);
    if (!span) throw new AppError("VALIDATION_ERROR");
    return (
      tag.slice(0, span.start - shift) +
      `${name}=${attributeValue(value)}` +
      tag.slice(span.end - shift)
    );
  }
  const close = tag.endsWith("/>") ? tag.length - 2 : tag.length - 1;
  const before = tag.slice(0, close).replace(/\s*$/, "");
  return `${before} ${name}=${attributeValue(value)}${tag.endsWith("/>") ? " />" : ">"}`;
}
