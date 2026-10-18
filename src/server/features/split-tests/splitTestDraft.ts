import {
  checkDraft,
  LENGTH_RULES,
} from "@/server/features/publishing/draftChecks";
import {
  fieldProperty,
  isNamed,
  parseSource,
  walk,
  type Program,
} from "@/server/features/publishing/metadataSyntax";

// RFC-0011 5.4 phase 2: Relay drafts the template edit for three simple
// patterns, a fixed suffix, a fixed prefix or a swap to another field, and
// changes only the targeted property of the object that generateMetadata
// returns. Parsing reads syntax only; nothing executes.
export type VariantDraft =
  | { kind: "suffix" | "prefix"; text: string }
  | { kind: "swap"; expression: string };
type Field = "title" | "description";
type Range = { start: number; end: number };

const rangeOf = (value: unknown): Range | null => {
  const start: unknown = value && Reflect.get(Object(value), "start");
  const end: unknown = value && Reflect.get(Object(value), "end");
  return typeof start === "number" && typeof end === "number"
    ? { start, end }
    : null;
};

/** The exported generateMetadata function node, or null. */
function generateMetadata(program: Program) {
  for (const statement of program.body) {
    if (statement.type !== "ExportNamedDeclaration") continue;
    const declaration = statement.declaration;
    if (
      declaration?.type === "FunctionDeclaration" &&
      isNamed(declaration.id, "generateMetadata")
    )
      return declaration;
    if (declaration?.type === "VariableDeclaration")
      for (const item of declaration.declarations)
        if (
          isNamed(item.id, "generateMetadata") &&
          (item.init?.type === "ArrowFunctionExpression" ||
            item.init?.type === "FunctionExpression")
        )
          return item.init;
  }
  return null;
}

/**
 * The page path as a template literal: each dynamic segment comes from
 * `await params` destructuring, or from `params.name`.
 */
function pathLiteral(
  fn: NonNullable<ReturnType<typeof generateMetadata>>,
  templatePath: string,
) {
  const [first] = fn.params;
  const paramsProperty =
    first?.type === "ObjectPattern"
      ? first.properties.find(
          (property) =>
            property.type === "ObjectProperty" &&
            isNamed(property.key, "params"),
        )
      : undefined;
  const params =
    paramsProperty?.type === "ObjectProperty" &&
    paramsProperty.value.type === "Identifier"
      ? paramsProperty.value.name
      : null;
  if (!params) return null;
  const awaited = new Map<string, string>();
  walk(fn.body, (node) => {
    if (node.type !== "VariableDeclarator") return;
    const { id, init } = node;
    if (
      !init ||
      typeof init !== "object" ||
      Reflect.get(init, "type") !== "AwaitExpression" ||
      !isNamed(Reflect.get(init, "argument"), params) ||
      !id ||
      typeof id !== "object" ||
      Reflect.get(id, "type") !== "ObjectPattern"
    )
      return;
    const properties: unknown = Reflect.get(id, "properties");
    if (!Array.isArray(properties)) return;
    for (const property of properties as unknown[]) {
      const key: unknown = property && Reflect.get(Object(property), "key");
      const value: unknown = property && Reflect.get(Object(property), "value");
      const name: unknown = key && Reflect.get(Object(key), "name");
      const local: unknown = value && Reflect.get(Object(value), "name");
      if (typeof name === "string" && typeof local === "string")
        awaited.set(name, local);
    }
  });
  const segments = templatePath
    .replace(/^.*?app\//, "")
    .split("/")
    .slice(0, -1)
    .filter((segment) => !/^\(.*\)$/.test(segment) && !segment.startsWith("@"));
  const parts: string[] = [];
  for (const segment of segments) {
    const name = segment.replace(/^\[(\.\.\.)?|\]$/g, "");
    if (!segment.startsWith("[")) {
      parts.push(segment);
      continue;
    }
    const value =
      awaited.get(name) ?? (awaited.size ? null : `${params}.${name}`);
    if (!value) return null;
    parts.push(
      segment.startsWith("[...") ? `\${${value}.join("/")}` : `\${${value}}`,
    );
  }
  return `\`/${parts.join("/")}\``;
}

/** The object literal that generateMetadata returns, when it is the only return. */
type ObjectNode = Parameters<typeof fieldProperty>[0];
const isObjectNode = (value: unknown): value is ObjectNode =>
  Boolean(value) && Reflect.get(Object(value), "type") === "ObjectExpression";

function returnedObject(fn: NonNullable<ReturnType<typeof generateMetadata>>) {
  const returns: unknown[] = [];
  walk(fn.body, (node) => {
    if (node.type === "ReturnStatement") returns.push(node.argument);
  });
  const [only] = returns;
  return returns.length === 1 && isObjectNode(only) ? only : null;
}

const escapeLiteral = (text: string) =>
  text.replace(/[\\`]/g, "\\$&").replaceAll("${", "\\${");

/** The property sources of an object literal, by key. */
function propertySources(source: string, object: unknown) {
  const properties: unknown = Reflect.get(Object(object), "properties");
  return new Map(
    (Array.isArray(properties) ? (properties as unknown[]) : []).map(
      (property) => {
        const key: unknown = Reflect.get(Object(property), "key");
        const name: unknown = key && Reflect.get(Object(key), "name");
        const range = rangeOf(property);
        return [
          String(name),
          range ? source.slice(range.start, range.end) : "",
        ] as const;
      },
    ),
  );
}

export function draftTemplate(input: {
  source: string;
  templatePath: string;
  field: Field;
  draft: VariantDraft;
  importPath: string;
}): { source: string; problems: string[] } {
  const { source, templatePath, field, draft } = input;
  const refuse = (problem: string) => ({ source, problems: [problem] });
  let program: Program;
  try {
    program = parseSource(source, templatePath);
  } catch {
    return refuse(`${templatePath} could not be parsed.`);
  }
  const fn = generateMetadata(program);
  if (!fn)
    return refuse(
      `${templatePath} has no exported generateMetadata. Write the edit by hand.`,
    );
  const object = returnedObject(fn);
  if (!object)
    return refuse(
      "generateMetadata must return one object literal. Write the edit by hand.",
    );
  let property: ReturnType<typeof fieldProperty>;
  try {
    property = fieldProperty(object, field);
  } catch (error) {
    return refuse(
      error instanceof Error ? error.message : "Unsupported metadata.",
    );
  }
  const value = rangeOf(property?.value);
  if (!property || !value)
    return refuse(`The metadata has no ${field} to change.`);
  const path = pathLiteral(fn, templatePath);
  if (!path)
    return refuse(
      "Relay cannot find the route parameters of generateMetadata. Write the edit by hand.",
    );
  const current = source.slice(value.start, value.end);
  let variant: string;
  if (draft.kind === "swap") {
    let parsed: Program;
    try {
      parsed = parseSource(`(${draft.expression});`, "swap.ts");
    } catch {
      return refuse(
        "Enter the other field as a name such as integration.name.",
      );
    }
    const [statement] = parsed.body;
    let plain = statement?.type === "ExpressionStatement";
    walk(statement, (node) => {
      if (
        !["ExpressionStatement", "Identifier", "MemberExpression"].includes(
          String(node.type),
        ) ||
        node.computed === true
      )
        plain = false;
    });
    if (!plain || parsed.body.length !== 1)
      return refuse(
        "Enter the other field as a name such as integration.name.",
      );
    variant = draft.expression.trim();
  } else {
    const text = escapeLiteral(draft.text);
    variant =
      draft.kind === "suffix"
        ? `\`\${${current}}${text}\``
        : `\`${text}\${${current}}\``;
  }
  const replaced = `inSplitVariant(${path})\n      ? ${variant}\n      : ${current}`;
  const lastImport = program.body
    .filter((statement) => statement.type === "ImportDeclaration")
    .at(-1);
  const importAt = rangeOf(lastImport)?.end ?? 0;
  const importLine = `${importAt ? "\n" : ""}import { inSplitVariant } from "${input.importPath}";${importAt ? "" : "\n"}`;
  const next =
    source.slice(0, importAt) +
    importLine +
    source.slice(importAt, value.start) +
    replaced +
    source.slice(value.end);

  // The check: the result parses, and only the targeted property changed.
  let after: Program;
  try {
    after = parseSource(next, templatePath);
  } catch {
    return refuse(
      "The drafted template did not parse. Write the edit by hand.",
    );
  }
  const afterFn = generateMetadata(after);
  const afterObject = afterFn ? returnedObject(afterFn) : null;
  const before = propertySources(source, object);
  const changed = afterObject ? propertySources(next, afterObject) : new Map();
  const same =
    before.size === changed.size &&
    [...before].every(
      ([key, text]) => key === field || changed.get(key) === text,
    );
  if (!same)
    return refuse("The draft changed more than the targeted property.");
  return { source: next, problems: [] };
}

/**
 * The RFC-0004 checks on each variant page's final value, from its live
 * original. A swap's values are not known, so it has no checks here.
 */
export function checkVariantText(
  field: Field,
  draft: VariantDraft,
  originals: Array<string | null>,
) {
  if (draft.kind === "swap") return [];
  const rule =
    field === "title" ? LENGTH_RULES.meta_title : LENGTH_RULES.meta_description;
  const counts = new Map<string, number>();
  for (const original of originals) {
    if (original === null) continue;
    const text =
      draft.kind === "suffix"
        ? `${original}${draft.text}`
        : `${draft.text}${original}`;
    for (const failure of checkDraft(
      { text, rationale: "", usedQueries: [], claims: [] },
      {
        queries: [],
        pageTitle: "",
        pageText: "",
        contextText: draft.text,
        currentValue: original,
      },
      rule,
    ))
      counts.set(
        failure.replace(/has \d+ characters/, "is outside the length"),
        (counts.get(failure) ?? 0) + 1,
      );
  }
  return [...counts].map(
    ([failure, count]) => `${count} variant pages: ${failure}`,
  );
}
