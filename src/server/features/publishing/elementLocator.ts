import { AppError } from "@/server/lib/errors";
import { reachableFiles, type SourceFile } from "./copyLocator";
import { parseSource, walk, type Program } from "./metadataSyntax";

// RFC-0013 5.4: find the one JSX element that an accessibility fix changes,
// and set one attribute on it. RFC-0014 reuses this change kind. Parsing
// reads syntax only; nothing executes.
export type ElementTarget =
  | { kind: "image"; src: string }
  | { kind: "html" }
  // One literal attribute; with `tokens`, a class list that has every token.
  | {
      kind: "attribute";
      tags: string[];
      name: string;
      value: string;
      tokens?: boolean;
    }
  // RFC-0014: any test of the element's attributes.
  | {
      kind: "where";
      tags: string[];
      test: (attributes: Attributes) => boolean;
    };
/** Literal values; true for a bare attribute; null for an expression. */
export type Attributes = Map<string, string | true | null>;
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

function attributesOf(node: unknown): Attributes {
  const attributes: Attributes = new Map();
  for (const attribute of list(field(node, "attributes"))) {
    if (field(attribute, "type") !== "JSXAttribute") continue;
    const value = field(attribute, "value");
    attributes.set(
      String(field(field(attribute, "name"), "name")),
      value === null || value === undefined
        ? true
        : field(value, "type") === "StringLiteral"
          ? String(field(value, "value"))
          : null,
    );
  }
  return attributes;
}

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
  if (target.kind === "where")
    return (
      typeof name === "string" &&
      target.tags.includes(name) &&
      target.test(attributesOf(node))
    );
  if (target.kind === "attribute") {
    if (typeof name !== "string" || !target.tags.includes(name)) return false;
    const names =
      target.name === "className" ? ["className", "class"] : [target.name];
    const value = field(
      list(field(node, "attributes")).find(
        (attribute) =>
          field(attribute, "type") === "JSXAttribute" &&
          names.includes(String(field(field(attribute, "name"), "name"))),
      ),
      "value",
    );
    if (field(value, "type") !== "StringLiteral") return false;
    const literal = String(field(value, "value"));
    if (!target.tokens) return literal === target.value;
    const present = new Set(literal.split(/\s+/));
    return target.value.split(/\s+/).every((token) => present.has(token));
  }
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

/** The attributes of one opening tag, parsed from the tag text alone. */
function tagNodes(tag: string) {
  // Closed so it parses; the "(" shifts offsets by one.
  const tagName = /^<([A-Za-z][\w.:-]*)/.exec(tag)?.[1] ?? "x";
  const program = parseSource(
    tag.endsWith("/>") ? `(${tag})` : `(${tag}</${tagName}>)`,
    "tag.tsx",
  );
  let opening: Record<string, unknown> | null = null;
  walk(program, (node) => {
    if (node.type === "JSXOpeningElement" && !opening) opening = node;
  });
  return opening;
}

/** The literal attributes of an opening tag. */
export const tagAttributes = (tag: string) => attributesOf(tagNodes(tag));

/**
 * The opening tag with `name` set to `value`: `true` writes a bare attribute
 * and null removes it. A new attribute goes last, so no spread can override
 * it; an existing one followed by a spread is refused.
 */
export function editTag(
  tag: string,
  name: string,
  value: string | true | null,
) {
  const attributes = list(field(tagNodes(tag), "attributes"));
  const index = attributes.findIndex(
    (attribute) =>
      field(attribute, "type") === "JSXAttribute" &&
      field(field(attribute, "name"), "name") === name,
  );
  const text = value === true ? name : `${name}=${attributeValue(value ?? "")}`;
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
    const before = tag.slice(0, span.start - shift);
    return value === null
      ? before.replace(/\s+$/, "") + tag.slice(span.end - shift)
      : before + text + tag.slice(span.end - shift);
  }
  if (value === null) return tag;
  const close = tag.endsWith("/>") ? tag.length - 2 : tag.length - 1;
  const before = tag.slice(0, close).replace(/\s*$/, "");
  return `${before} ${text}${tag.endsWith("/>") ? " />" : ">"}`;
}

/** The opening tag of `element` with `name` set to `value`. */
export function withAttribute(
  file: SourceFile,
  element: Range,
  name: string,
  value: string,
) {
  return editTag(file.source.slice(element.start, element.end), name, value);
}
