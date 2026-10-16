import { helperCall, helperDescription } from "./metadataHelper";
import {
  invalid,
  parseSource,
  unwrap,
  walk,
  fieldProperty,
  type CallNode,
  type Expression,
  type HelperFile,
} from "./metadataSyntax";

type Target = { path: string; url: string; rootDirectory?: string };

// Next.js route groups such as (site) organize files and are not part of the URL.
const ROUTE_GROUP = /^\([a-z0-9-]+\)$/;

function safeSegments(value: string): boolean {
  return value
    .split("/")
    .every(
      (segment) =>
        ROUTE_GROUP.test(segment) ||
        /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(segment),
    );
}

function rejectUnsupportedSegments(path: string) {
  for (const segment of path.split("/")) {
    if (/^\[.+\]$/.test(segment))
      invalid(
        `The dynamic route segment ${segment} is not supported. Relay changes static pages only. Track this page as a ticket instead.`,
      );
    if (segment.startsWith("@"))
      invalid(`The parallel route ${segment} is not supported.`);
    if (/^\(\.{1,3}\)/.test(segment))
      invalid(`The intercepting route ${segment} is not supported.`);
  }
}

// Deliberately narrower than Next routing: no rewrites, basePath, private folders,
// dynamic routes, encoded paths, or filesystem normalization. Two route groups
// that map to one URL fail the Next.js build, so no deployed site has them.
export function validateMetadataTarget({
  path,
  url,
  rootDirectory = "",
}: Target): void {
  rejectUnsupportedSegments(path);
  if (
    !safeSegments(path) ||
    (rootDirectory !== "" && !safeSegments(rootDirectory))
  ) {
    invalid("Metadata target must use a plain repository-relative file path.");
  }
  const prefix = rootDirectory ? `${rootDirectory}/` : "";
  if (!path.startsWith(prefix))
    invalid("Metadata target is outside the configured root directory.");
  const relative = path.slice(prefix.length);
  const match = /^(?:src\/)?app\/(.*\/)?page\.(?:ts|tsx|js|jsx)$/.exec(
    relative,
  );
  if (!match) invalid("Metadata target must be an App Router page file.");
  const folders = match[1]?.slice(0, -1).split("/") ?? [];
  if (folders.some((segment) => segment.startsWith("_"))) {
    invalid("Private route folders are not supported.");
  }
  const route = folders
    .filter((segment) => !ROUTE_GROUP.test(segment))
    .join("/");
  const raw = /^https?:\/\/[^/?#\\\s]+(\/[^?#\\\s]*)?$/.exec(url);
  if (!raw || url.includes("%"))
    invalid(
      "Metadata URL must be an unencoded HTTP URL without query or fragment.",
    );
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    invalid("Metadata URL is invalid.");
  }
  const pathname = raw[1] ?? "/";
  if (parsed.username || parsed.password || parsed.pathname !== pathname) {
    invalid(
      "Metadata URL must not contain credentials or normalized path segments.",
    );
  }
  const expected = route ? `/${route}` : "/";
  if (pathname !== expected && !(route && pathname === `${expected}/`)) {
    invalid("Metadata URL pathname does not match the page file.");
  }
}

// The page's `export const metadata = ...` initializer, after page-level checks.
function metadataInit(source: string, path: string) {
  const program = parseSource(source, path);
  if (
    program.directives.some(
      (directive) => directive.value.value === "use client",
    )
  ) {
    invalid("Client components cannot be edited as static metadata pages.");
  }
  let references = 0;
  walk(program, (node) => {
    if (node.type === "Identifier" && node.name === "metadata") references++;
    if (
      node.type === "ExportAllDeclaration" ||
      (node.type === "Identifier" && node.name === "generateMetadata") ||
      (node.type === "ExportSpecifier" &&
        typeof node.exported === "object" &&
        node.exported !== null &&
        "value" in node.exported &&
        ["metadata", "generateMetadata"].includes(String(node.exported.value)))
    ) {
      invalid("Dynamic or indirect metadata exports are not supported.");
    }
    if (
      node.type === "CallExpression" &&
      typeof node.callee === "object" &&
      node.callee !== null &&
      "name" in node.callee &&
      node.callee.name === "eval"
    ) {
      invalid("Sources using eval are not supported.");
    }
  });
  if (references !== 1)
    invalid(
      "Metadata must have one declaration and no other references or mutations.",
    );
  const declarations = program.body.flatMap((statement) => {
    if (
      statement.type !== "ExportNamedDeclaration" ||
      statement.declaration?.type !== "VariableDeclaration" ||
      statement.declaration.kind !== "const"
    )
      return [];
    return statement.declaration.declarations.filter(
      (declaration) =>
        declaration.id.type === "Identifier" &&
        declaration.id.name === "metadata",
    );
  });
  if (declarations.length !== 1 || !declarations[0].init) {
    invalid("Expected exactly one direct export const metadata declaration.");
  }
  return { program, init: unwrap(declarations[0].init) };
}

/** The helper import to resolve when the page sets metadata through a call, or null. */
export function metadataHelperImport(source: string, path: string) {
  const { program, init } = metadataInit(source, path);
  if (init.type === "ObjectExpression") return null;
  const { name, specifier } = helperCall(program, init);
  return { name, specifier };
}

function descriptionLiteral(source: string, path: string, helper?: HelperFile) {
  const { program, init } = metadataInit(source, path);
  let found: {
    node:
      | Expression
      | Exclude<CallNode["arguments"][number], Expression>
      | undefined;
    value: string;
    helperNote: string | null;
  };
  if (init.type === "ObjectExpression") {
    if (helper) invalid("Metadata no longer uses the metadata helper.");
    const property = fieldProperty(init, "description");
    if (!property)
      invalid("Metadata must contain an existing string literal description.");
    if (property.value.type !== "StringLiteral")
      invalid("Metadata description must be an existing string literal.");
    found = {
      node: property.value,
      value: property.value.value,
      helperNote: null,
    };
  } else {
    const { call, name } = helperCall(program, init);
    if (!helper) invalid("Metadata uses a helper that was not read.");
    found = helperDescription(call, name, helper);
  }
  const { node } = found;
  if (!node || node.start == null || node.end == null || !node.loc) {
    invalid("Metadata must contain an existing string literal description.");
  }
  return {
    value: found.value,
    helperNote: found.helperNote,
    start: node.start,
    end: node.end,
    line: node.loc.start.line,
    quote: source[node.start],
  };
}

function printable(value: string): string {
  return JSON.stringify(value).replace(
    /[\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

// Keeps the file's quote style, so the repository's formatter check still
// passes. Like Prettier, it switches quotes only when that needs fewer escapes.
function quoted(value: string, quote: string): string {
  const json = printable(value);
  const singles = value.split("'").length - 1;
  const doubles = value.split('"').length - 1;
  const single = quote === "'" ? singles <= doubles : singles < doubles;
  return single
    ? `'${json.slice(1, -1).replaceAll('\\"', '"').replaceAll("'", "\\'")}'`
    : json;
}

export function prepareMetadataDescription(
  input: Target & {
    source: string;
    newDescription: string;
    helper?: HelperFile;
  },
) {
  validateMetadataTarget(input);
  if (new TextEncoder().encode(input.source).byteLength > 32 * 1024) {
    invalid("Metadata source exceeds the 32 KiB limit.");
  }
  if (/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(input.newDescription)) {
    invalid("The new description must not contain control characters.");
  }
  const afterDescription = input.newDescription.trim();
  if (afterDescription.length < 1 || afterDescription.length > 320) {
    invalid(
      "The new description must contain 1 to 320 characters after trimming.",
    );
  }
  const before = descriptionLiteral(input.source, input.path, input.helper);
  if (afterDescription === before.value) {
    invalid("The new description must differ from the existing description.");
  }
  const literal = quoted(afterDescription, before.quote);
  const prefix = input.source.slice(0, before.start);
  const suffix = input.source.slice(before.end);
  const afterSource = prefix + literal + suffix;
  const after = descriptionLiteral(afterSource, input.path, input.helper);
  if (
    after.value !== afterDescription ||
    after.start !== before.start ||
    afterSource.slice(0, after.start) !== prefix ||
    afterSource.slice(after.end) !== suffix
  ) {
    invalid("Metadata patch failed single-literal preservation validation.");
  }
  return {
    beforeDescription: before.value,
    afterDescription,
    beforeSnippet: `Line ${before.line}: ${printable(before.value)}`,
    afterSnippet: `Line ${after.line}: ${literal}`,
    afterSource,
    helperNote: before.helperNote,
    validationSummary: before.helperNote
      ? "Validated direct path correspondence, a metadata helper call whose description comes straight from one parameter, a literal call argument, no metadata references, reparsed output, and unchanged surrounding source. Human-provided description only."
      : "Validated direct path correspondence, direct metadata export, literal description, no metadata references, reparsed output, and unchanged surrounding source. Human-provided description only.",
  };
}
