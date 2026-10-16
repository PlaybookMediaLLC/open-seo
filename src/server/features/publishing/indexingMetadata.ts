import {
  fieldProperty,
  invalid,
  parseSource,
  unwrap,
  type Program,
} from "./metadataSyntax";
import { validateMetadataTarget } from "./nextMetadata";

// Canonical and robots changes (RFC-0005 5.9). App Router only, and only in a
// literal metadata object: `alternates: { canonical: '/path' }` and
// `robots: { index: true, follow: true }`. These changes can remove a page
// from Google, so the proposal service also requires a typed confirmation.
export type Robots = { index: boolean; follow: boolean };
type Literal = { start: number; end: number; line: number; text: string };
type Expression = Extract<
  Program["body"][number],
  { type: "ExpressionStatement" }
>["expression"];

const robotsText = (robots: Robots) =>
  `${robots.index ? "index" : "noindex"}, ${robots.follow ? "follow" : "nofollow"}`;

export function parseRobotsText(value: string): Robots {
  const match = /^(index|noindex), (follow|nofollow)$/.exec(value);
  if (!match) invalid("Stored robots value is not readable.");
  return { index: match[1] === "index", follow: match[2] === "follow" };
}

function metadataObject(source: string, path: string) {
  const init = parseSource(source, path)
    .body.flatMap((statement) =>
      statement.type === "ExportNamedDeclaration" &&
      statement.declaration?.type === "VariableDeclaration" &&
      statement.declaration.kind === "const"
        ? statement.declaration.declarations
        : [],
    )
    .find(
      (declaration) =>
        declaration.id.type === "Identifier" &&
        declaration.id.name === "metadata",
    )?.init;
  const object = init && unwrap(init);
  if (object?.type !== "ObjectExpression")
    invalid(
      "Relay changes canonical and robots only in a literal metadata object.",
    );
  return object;
}

const line = (literal: Literal | undefined) => literal?.line ?? 0;

function located(node: Expression, text: string): Literal {
  if (node.start == null || node.end == null || !node.loc)
    invalid("Metadata source could not be parsed safely.");
  return { start: node.start, end: node.end, line: node.loc.start.line, text };
}

function readFields(source: string, path: string) {
  const metadata = metadataObject(source, path);
  let canonical: Literal | undefined;
  const alternates = fieldProperty(metadata, "alternates")?.value;
  if (alternates?.type === "ObjectExpression") {
    const value = fieldProperty(alternates, "canonical")?.value;
    if (value?.type === "StringLiteral")
      canonical = located(value, value.value);
    else if (value)
      invalid("The canonical URL must be literal text in alternates.");
  }
  const robots: Partial<Record<keyof Robots, Literal & { value: boolean }>> =
    {};
  const robotsValue = fieldProperty(metadata, "robots")?.value;
  if (robotsValue && robotsValue.type !== "ObjectExpression")
    invalid("Relay changes only robots: { index, follow } with true or false.");
  for (const key of ["index", "follow"] as const) {
    const value =
      robotsValue?.type === "ObjectExpression"
        ? fieldProperty(robotsValue, key)?.value
        : undefined;
    if (value && value.type !== "BooleanLiteral")
      invalid(`robots.${key} must be true or false.`);
    if (value?.type === "BooleanLiteral")
      robots[key] = {
        ...located(value, String(value.value)),
        value: value.value,
      };
  }
  return { canonical, robots };
}

function validCanonical(value: string) {
  const canonical = value.trim();
  const path = /^\/(?!\/)[^\s]*$/.test(canonical);
  let absolute = false;
  try {
    absolute =
      new URL(canonical).protocol === "https:" && !/\s/.test(canonical);
  } catch {
    absolute = false;
  }
  if ((!path && !absolute) || canonical.length > 500)
    invalid(
      "The canonical URL must be a path such as /pricing or an https:// URL.",
    );
  return canonical;
}

export function prepareIndexingChange(input: {
  path: string;
  url: string;
  rootDirectory: string;
  source: string;
  newCanonical?: string;
  newRobots?: Robots;
}) {
  validateMetadataTarget(input);
  if (new TextEncoder().encode(input.source).byteLength > 32 * 1024)
    invalid("Metadata source exceeds the 32 KiB limit.");
  const before = readFields(input.source, input.path);
  const edits: { start: number; end: number; text: string }[] = [];
  let canonicalAfter: string | null = null;
  if (input.newCanonical !== undefined) {
    canonicalAfter = validCanonical(input.newCanonical);
    if (!before.canonical)
      invalid("The page has no literal alternates.canonical to change.");
    if (canonicalAfter === before.canonical.text)
      invalid("The new canonical URL must differ from the existing one.");
    edits.push({ ...before.canonical, text: JSON.stringify(canonicalAfter) });
  }
  if (input.newRobots) {
    const { index, follow } = before.robots;
    if (!index || !follow)
      invalid("The page must set both robots.index and robots.follow.");
    if (
      index.value === input.newRobots.index &&
      follow.value === input.newRobots.follow
    )
      invalid("The new robots value must differ from the existing one.");
    if (index.value !== input.newRobots.index)
      edits.push({ ...index, text: String(input.newRobots.index) });
    if (follow.value !== input.newRobots.follow)
      edits.push({ ...follow, text: String(input.newRobots.follow) });
  }
  if (!edits.length) invalid("Enter a new canonical URL or robots value.");
  // Edit from the end of the file, so earlier offsets stay valid.
  const descending: typeof edits = [];
  for (const edit of edits) {
    const index = descending.findIndex((other) => other.start < edit.start);
    descending.splice(index < 0 ? descending.length : index, 0, edit);
  }
  let afterSource = input.source;
  for (const edit of descending)
    afterSource =
      afterSource.slice(0, edit.start) +
      edit.text +
      afterSource.slice(edit.end);
  const after = readFields(afterSource, input.path);
  const robotsAfter =
    after.robots.index && after.robots.follow
      ? { index: after.robots.index.value, follow: after.robots.follow.value }
      : null;
  if (
    (canonicalAfter !== null && after.canonical?.text !== canonicalAfter) ||
    (input.newRobots &&
      (robotsAfter?.index !== input.newRobots.index ||
        robotsAfter.follow !== input.newRobots.follow))
  )
    invalid("Metadata patch failed single-literal preservation validation.");
  const robotsBefore =
    before.robots.index && before.robots.follow
      ? robotsText({
          index: before.robots.index.value,
          follow: before.robots.follow.value,
        })
      : null;
  return {
    afterSource,
    canonicalBefore:
      canonicalAfter === null ? null : (before.canonical?.text ?? null),
    canonicalAfter,
    canonicalBeforeSnippet:
      canonicalAfter === null
        ? null
        : `Line ${line(before.canonical)}: ${JSON.stringify(before.canonical?.text)}`,
    canonicalAfterSnippet:
      canonicalAfter === null
        ? null
        : `Line ${line(after.canonical)}: ${JSON.stringify(canonicalAfter)}`,
    robotsBefore: input.newRobots ? robotsBefore : null,
    robotsAfter: input.newRobots ? robotsText(input.newRobots) : null,
    robotsBeforeSnippet: input.newRobots
      ? `Line ${line(before.robots.index)}: robots ${robotsBefore}`
      : null,
    robotsAfterSnippet: input.newRobots
      ? `Line ${line(after.robots.index)}: robots ${robotsText(input.newRobots)}`
      : null,
  };
}
