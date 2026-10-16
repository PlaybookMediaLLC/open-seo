import { helperCall, helperField } from "./metadataHelper";
import {
  invalid,
  parseSource,
  unwrap,
  walk,
  fieldProperty,
  type CallNode,
  type Expression,
  type HelperFile,
  type MetadataField,
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
  // A Pages Router file name is a segment too, as in pages/[slug].tsx.
  for (const segment of path.replace(/\.(?:tsx|ts|jsx|js)$/, "").split("/")) {
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
/** The file path relative to the root directory, after the shared path checks. */
export function relativeTarget(path: string, rootDirectory: string) {
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
  return path.slice(prefix.length);
}

/** Checks that the page URL is plain and that its pathname is the route. */
export function matchRoutePath(url: string, route: string) {
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

export function validateMetadataTarget({
  path,
  url,
  rootDirectory = "",
}: Target): void {
  const relative = relativeTarget(path, rootDirectory);
  const match = /^(?:src\/)?app\/(.*\/)?page\.(?:ts|tsx|js|jsx)$/.exec(
    relative,
  );
  if (!match) invalid("Metadata target must be an App Router page file.");
  const folders = match[1]?.slice(0, -1).split("/") ?? [];
  if (folders.some((segment) => segment.startsWith("_"))) {
    invalid("Private route folders are not supported.");
  }
  matchRoutePath(
    url,
    folders.filter((segment) => !ROUTE_GROUP.test(segment)).join("/"),
  );
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

function fieldLiteral(
  source: string,
  path: string,
  field: MetadataField,
  helper?: HelperFile,
) {
  const { program, init } = metadataInit(source, path);
  let found: {
    node:
      | Expression
      | Exclude<CallNode["arguments"][number], Expression>
      | undefined;
    value: string;
    helperNote: string | null;
  } | null;
  if (init.type === "ObjectExpression") {
    if (helper) invalid("Metadata no longer uses the metadata helper.");
    const property = fieldProperty(init, field);
    if (field === "title" && property?.value.type === "ObjectExpression")
      invalid(
        "The page title uses the { default, template, absolute } form. Relay can change only a plain title string.",
      );
    if (property && property.value.type !== "StringLiteral")
      invalid(`Metadata ${field} must be an existing string literal.`);
    found =
      property?.value.type === "StringLiteral"
        ? {
            node: property.value,
            value: property.value.value,
            helperNote: null,
          }
        : null;
  } else {
    const { call, name } = helperCall(program, init);
    if (!helper) invalid("Metadata uses a helper that was not read.");
    found = helperField(call, name, helper, field);
  }
  if (!found) return null;
  const { node } = found;
  if (!node || node.start == null || node.end == null || !node.loc) {
    invalid(`Metadata must contain an existing string literal ${field}.`);
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

/** The unchanged description of a literal metadata object. */
export function currentDescription(source: string, path: string) {
  const literal = fieldLiteral(source, path, "description");
  return literal
    ? {
        value: literal.value,
        snippet: `Line ${literal.line}: ${printable(literal.value)}`,
      }
    : { value: "", snippet: "No description literal." };
}

type Change = { field: MetadataField; after: string };

function newText(field: MetadataField, value: string, max: number) {
  if (/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(value)) {
    invalid(`The new ${field} must not contain control characters.`);
  }
  const text = value.trim();
  if (text.length < 1 || text.length > max) {
    invalid(
      `The new ${field} must contain 1 to ${max} characters after trimming.`,
    );
  }
  return text;
}

/**
 * Replaces the title literal, the description literal, or both, in one page.
 * `titleTemplate` is the nearest layout's `title.template`, used for the
 * final-title rule (10 to 60 characters).
 */
export function prepareMetadataChange(
  input: Target & {
    source: string;
    helper?: HelperFile;
    newDescription?: string;
    newTitle?: string;
    titleTemplate?: string | null;
    // A revert restores the earlier text exactly, even outside the length rule.
    restore?: boolean;
  },
) {
  validateMetadataTarget(input);
  if (new TextEncoder().encode(input.source).byteLength > 32 * 1024) {
    invalid("Metadata source exceeds the 32 KiB limit.");
  }
  const changes: Change[] = [];
  if (input.newDescription !== undefined)
    changes.push({
      field: "description",
      after: newText("description", input.newDescription, 320),
    });
  let finalTitle: string | null = null;
  if (input.newTitle !== undefined) {
    const after = newText("title", input.newTitle, 120);
    finalTitle = input.titleTemplate
      ? input.titleTemplate.replace("%s", after)
      : after;
    if (!input.restore && (finalTitle.length < 10 || finalTitle.length > 60))
      invalid(
        `The final title "${finalTitle}" has ${finalTitle.length} characters. Use 10 to 60.`,
      );
    changes.push({ field: "title", after });
  }
  if (!changes.length)
    invalid("Enter a new title, a new description, or both.");
  const read = (source: string, field: MetadataField) => {
    const literal = fieldLiteral(source, input.path, field, input.helper);
    if (!literal)
      invalid(
        input.helper
          ? `The metadata helper does not return a ${field} field.`
          : `Metadata must contain an existing string literal ${field}.`,
      );
    return literal;
  };
  const planned = changes.map((change) => {
    const before = read(input.source, change.field);
    if (change.after === before.value)
      invalid(
        `The new ${change.field} must differ from the existing ${change.field}.`,
      );
    return { ...change, before, literal: quoted(change.after, before.quote) };
  });
  const ascending =
    planned.length === 2 && planned[0].before.start > planned[1].before.start
      ? [planned[1], planned[0]]
      : planned;
  // Edit from the end of the file, so earlier offsets stay valid.
  const descending =
    ascending.length === 2 ? [ascending[1], ascending[0]] : ascending;
  let afterSource = input.source;
  for (const change of descending)
    afterSource =
      afterSource.slice(0, change.before.start) +
      change.literal +
      afterSource.slice(change.before.end);
  // Parse again. Each literal must hold its new value, and the text between
  // and around the literals must be unchanged.
  let beforeEnd = 0;
  let afterEnd = 0;
  const results = ascending.map((change) => {
    const after = read(afterSource, change.field);
    if (
      after.value !== change.after ||
      input.source.slice(beforeEnd, change.before.start) !==
        afterSource.slice(afterEnd, after.start)
    )
      invalid("Metadata patch failed single-literal preservation validation.");
    beforeEnd = change.before.end;
    afterEnd = after.end;
    return { ...change, afterLine: after.line };
  });
  if (input.source.slice(beforeEnd) !== afterSource.slice(afterEnd))
    invalid("Metadata patch failed single-literal preservation validation.");
  const result = (field: MetadataField) =>
    results.find((change) => change.field === field);
  const description = result("description");
  const title = result("title");
  // An unchanged description is recorded as is, so the proposal shows it.
  const current = description
    ? null
    : fieldLiteral(input.source, input.path, "description", input.helper);
  const currentSnippet = current
    ? `Line ${current.line}: ${printable(current.value)}`
    : "No description literal.";
  const fields = results.map((change) => change.field).join(" and ");
  return {
    afterSource,
    beforeDescription: description?.before.value ?? current?.value ?? "",
    afterDescription: description?.after ?? current?.value ?? "",
    beforeSnippet: description
      ? `Line ${description.before.line}: ${printable(description.before.value)}`
      : currentSnippet,
    afterSnippet: description
      ? `Line ${description.afterLine}: ${description.literal}`
      : currentSnippet,
    beforeTitle: title?.before.value ?? null,
    afterTitle: title?.after ?? null,
    titleBeforeSnippet: title
      ? `Line ${title.before.line}: ${printable(title.before.value)}`
      : null,
    titleAfterSnippet: title
      ? `Line ${title.afterLine}: ${title.literal}`
      : null,
    finalTitle,
    helperNote:
      results
        .map((change) => change.before.helperNote)
        .filter(Boolean)
        .join(" ") || null,
    validationSummary: `Validated direct path correspondence, ${
      input.helper
        ? "a metadata helper call whose fields come straight from its parameters, literal call arguments"
        : "a direct metadata export, literal values"
    }, no metadata references, reparsed output, and unchanged surrounding source for the ${fields}.${
      finalTitle
        ? ` Final title with the layout template: ${printable(finalTitle)} (${finalTitle.length} characters).`
        : ""
    } Human-provided text only.`,
  };
}
