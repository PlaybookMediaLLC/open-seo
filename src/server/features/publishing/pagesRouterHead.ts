import { invalid, parseSource, walk, type Program } from "./metadataSyntax";
import { matchRoutePath, relativeTarget } from "./nextMetadata";

// Pages Router support (RFC-0005 5.8): a direct <title> and
// <meta name="description" content="…" /> inside the page's own next/head.
type Expression = Extract<
  Program["body"][number],
  { type: "ExpressionStatement" }
>["expression"];
type JsxElement = Extract<Expression, { type: "JSXElement" }>;

const PAGES_FILE = /^(?:src\/)?pages\/(.+)\.(?:tsx|ts|jsx|js)$/;

export function isPagesRouterFile(path: string, rootDirectory: string) {
  const prefix = rootDirectory ? `${rootDirectory}/` : "";
  return path.startsWith(prefix) && PAGES_FILE.test(path.slice(prefix.length));
}

export function validatePagesTarget(
  path: string,
  url: string,
  rootDirectory: string,
) {
  const match = PAGES_FILE.exec(relativeTarget(path, rootDirectory));
  if (!match) invalid("Metadata target must be a Pages Router page file.");
  const segments = match[1].split("/");
  if (segments[0] === "api" || segments.some((part) => part.startsWith("_")))
    invalid("API routes, _app, _document and private files are not pages.");
  if (segments.at(-1) === "index") segments.pop();
  matchRoutePath(url, segments.join("/"));
}

function isJsxElement(node: unknown): node is JsxElement {
  return (
    typeof node === "object" &&
    node !== null &&
    "type" in node &&
    node.type === "JSXElement"
  );
}

const tagName = (element: JsxElement) =>
  element.openingElement.name.type === "JSXIdentifier"
    ? element.openingElement.name.name
    : null;

// React joins the lines of JSX text with single spaces.
const jsxText = (value: string) => value.replace(/\s*\n\s*/g, " ").trim();

function headFields(source: string, path: string) {
  const program = parseSource(source, path);
  let head: string | undefined;
  for (const statement of program.body)
    if (
      statement.type === "ImportDeclaration" &&
      statement.source.value === "next/head"
    )
      head = statement.specifiers.find(
        (specifier) => specifier.type === "ImportDefaultSpecifier",
      )?.local.name;
  if (!head) invalid("The page does not import Head from next/head.");
  const heads: JsxElement[] = [];
  walk(program, (node) => {
    if (isJsxElement(node) && tagName(node) === head) heads.push(node);
  });
  if (heads.length !== 1)
    invalid(
      heads.length
        ? "The page renders Head more than once."
        : "The page does not render Head itself. Relay cannot change a component that wraps Head.",
    );
  let title:
    | { start: number; end: number; line: number; value: string }
    | undefined;
  let description: typeof title;
  for (const child of heads[0].children) {
    if (!isJsxElement(child)) continue;
    const name = tagName(child);
    const attributes = child.openingElement.attributes;
    if (attributes.some((attribute) => attribute.type === "JSXSpreadAttribute"))
      invalid("Head elements with spread attributes are not supported.");
    if (name === "title") {
      const text = child.children[0];
      if (
        title ||
        child.children.length !== 1 ||
        text.type !== "JSXText" ||
        text.start == null ||
        text.end == null ||
        !text.loc
      )
        invalid("The title must be one plain text title in Head.");
      title = {
        start: text.start,
        end: text.end,
        line: text.loc.start.line,
        value: jsxText(text.value),
      };
    }
    if (name !== "meta") continue;
    const attribute = (key: string) =>
      attributes.find(
        (item) =>
          item.type === "JSXAttribute" &&
          item.name.type === "JSXIdentifier" &&
          item.name.name === key,
      );
    const nameAttribute = attribute("name");
    if (
      nameAttribute?.type !== "JSXAttribute" ||
      nameAttribute.value?.type !== "StringLiteral" ||
      nameAttribute.value.value !== "description"
    )
      continue;
    const content = attribute("content");
    if (
      description ||
      content?.type !== "JSXAttribute" ||
      content.value?.type !== "StringLiteral" ||
      content.value.start == null ||
      content.value.end == null ||
      !content.value.loc
    )
      invalid("The description must be one plain content string in Head.");
    description = {
      start: content.value.start,
      end: content.value.end,
      line: content.value.loc.start.line,
      value: content.value.value,
    };
  }
  return { title, description };
}

// Babel decodes HTML entities in JSX, so entities keep any text exact.
const escapeText = (value: string) =>
  value.replace(/[&<>{}]/g, (character) => `&#${character.charCodeAt(0)};`);
const escapeAttribute = (value: string) =>
  `"${value.replace(/[&"]/g, (character) => `&#${character.charCodeAt(0)};`)}"`;

type Field = { start: number; end: number; line: number; value: string };

const snippet = (field: Pick<Field, "line" | "value"> | undefined) =>
  field ? `Line ${field.line}: ${JSON.stringify(field.value)}` : null;

function plannedEdit(
  field: "title" | "description",
  value: string,
  max: number,
  current: Field | undefined,
  restore = false,
) {
  if (/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(value))
    invalid(`The new ${field} must not contain control characters.`);
  const after = value.trim();
  if (after.length < 1 || after.length > max)
    invalid(
      `The new ${field} must contain 1 to ${max} characters after trimming.`,
    );
  if (!current) invalid(`Head must contain an existing plain ${field}.`);
  if (after === current.value)
    invalid(`The new ${field} must differ from the existing ${field}.`);
  if (field === "title" && !restore && (after.length < 10 || after.length > 60))
    invalid(
      `The final title "${after}" has ${after.length} characters. Use 10 to 60.`,
    );
  return {
    field,
    after,
    start: current.start,
    end: current.end,
    text: field === "title" ? escapeText(after) : escapeAttribute(after),
  };
}

export function preparePagesHeadChange(input: {
  path: string;
  url: string;
  rootDirectory: string;
  source: string;
  newDescription?: string;
  newTitle?: string;
  restore?: boolean;
}) {
  validatePagesTarget(input.path, input.url, input.rootDirectory);
  if (new TextEncoder().encode(input.source).byteLength > 32 * 1024)
    invalid("Metadata source exceeds the 32 KiB limit.");
  const before = headFields(input.source, input.path);
  const edits: ReturnType<typeof plannedEdit>[] = [];
  for (const [field, value, max] of [
    ["description", input.newDescription, 320],
    ["title", input.newTitle, 120],
  ] as const)
    if (value !== undefined)
      edits.push(plannedEdit(field, value, max, before[field], input.restore));
  if (!edits.length) invalid("Enter a new title, a new description, or both.");
  // Edit from the end of the file, so earlier offsets stay valid.
  const descending =
    edits.length === 2 && edits[0].start < edits[1].start
      ? [edits[1], edits[0]]
      : edits;
  let afterSource = input.source;
  for (const edit of descending)
    afterSource =
      afterSource.slice(0, edit.start) +
      edit.text +
      afterSource.slice(edit.end);
  const after = headFields(afterSource, input.path);
  for (const edit of edits)
    if (after[edit.field]?.value !== edit.after)
      invalid("Metadata patch failed single-literal preservation validation.");
  const titleEdit = edits.find((edit) => edit.field === "title");
  const descriptionEdit = edits.find((edit) => edit.field === "description");
  const unchanged = snippet(before.description) ?? "No description in Head.";
  return {
    afterSource,
    beforeDescription: before.description?.value ?? "",
    afterDescription: descriptionEdit?.after ?? before.description?.value ?? "",
    beforeSnippet: descriptionEdit
      ? (snippet(before.description) ?? unchanged)
      : unchanged,
    afterSnippet: descriptionEdit
      ? (snippet(after.description) ?? unchanged)
      : unchanged,
    beforeTitle: titleEdit ? (before.title?.value ?? null) : null,
    afterTitle: titleEdit?.after ?? null,
    titleBeforeSnippet: titleEdit ? snippet(before.title) : null,
    titleAfterSnippet: titleEdit ? snippet(after.title) : null,
    finalTitle: titleEdit?.after ?? null,
    helperNote: null,
    validationSummary: `Validated direct path correspondence, one next/head element with plain text, reparsed output, and the ${edits
      .map((edit) => edit.field)
      .join(" and ")}. Human-provided text only.`,
  };
}
