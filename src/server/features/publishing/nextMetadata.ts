import { parse } from "@babel/parser";
import { AppError } from "@/server/lib/errors";

type Target = { path: string; url: string; rootDirectory?: string };
type Statement = ReturnType<typeof parse>["program"]["body"][number];
type Expression = Extract<
  Statement,
  { type: "ExpressionStatement" }
>["expression"];

function invalid(message: string): never {
  throw new AppError("VALIDATION_ERROR", message);
}

function safeSegments(value: string): boolean {
  return value
    .split("/")
    .every((segment) => /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(segment));
}

// Deliberately narrower than Next routing: no rewrites, basePath, private folders,
// route groups, dynamic routes, encoded paths, or filesystem normalization.
export function validateMetadataTarget({
  path,
  url,
  rootDirectory = "",
}: Target): void {
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
  const route = match[1]?.slice(0, -1) ?? "";
  if (route.split("/").some((segment) => segment.startsWith("_"))) {
    invalid("Private route folders are not supported.");
  }
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

function unwrap(expression: Expression): Expression {
  while (
    expression.type === "TSAsExpression" ||
    expression.type === "TSSatisfiesExpression" ||
    expression.type === "TSTypeAssertion" ||
    expression.type === "ParenthesizedExpression"
  ) {
    expression = expression.expression;
  }
  return expression;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isSyntaxNode(value: object): value is Record<string, unknown> {
  return "type" in value && typeof value.type === "string";
}

// Walk syntax only. No project imports, expressions, or repository code execute.
function walk(
  value: unknown,
  visit: (node: Record<string, unknown>) => void,
): void {
  const pending = [value];
  while (pending.length) {
    const child = pending.pop();
    if (!child || typeof child !== "object") continue;
    if (isUnknownArray(child)) {
      pending.push(...child);
      continue;
    }
    if (!isSyntaxNode(child)) continue;
    visit(child);
    pending.push(...Object.values(child));
  }
}

function descriptionLiteral(source: string, path: string) {
  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(source, {
      sourceType: "module",
      plugins: [
        ...(/\.tsx?$/.test(path) ? ["typescript" as const] : []),
        ...(!path.endsWith(".ts") ? ["jsx" as const] : []),
      ],
    });
  } catch {
    invalid("Metadata source could not be parsed safely.");
  }
  if (
    ast.program.directives.some(
      (directive) => directive.value.value === "use client",
    )
  ) {
    invalid("Client components cannot be edited as static metadata pages.");
  }
  let references = 0;
  walk(ast.program, (node) => {
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
  const declarations = ast.program.body.flatMap((statement) => {
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
  const object = unwrap(declarations[0].init);
  if (object.type !== "ObjectExpression")
    invalid("Metadata must be a plain object literal.");
  let description: Extract<Expression, { type: "StringLiteral" }> | undefined;
  for (const property of object.properties) {
    if (property.type === "SpreadElement" || property.computed) {
      invalid("Metadata spreads and computed keys are not supported.");
    }
    const key =
      property.key.type === "Identifier"
        ? property.key.name
        : property.key.type === "StringLiteral"
          ? property.key.value
          : null;
    if (key !== "description") {
      if (property.type === "ObjectMethod" || key === "__proto__") {
        invalid("Metadata methods and custom prototypes are not supported.");
      }
      continue;
    }
    if (description)
      invalid("Metadata must not contain duplicate description keys.");
    if (
      property.type !== "ObjectProperty" ||
      property.value.type !== "StringLiteral"
    ) {
      invalid("Metadata description must be an existing string literal.");
    }
    description = property.value;
  }
  if (
    !description ||
    description.start == null ||
    description.end == null ||
    !description.loc
  ) {
    invalid("Metadata must contain an existing string literal description.");
  }
  return {
    value: description.value,
    start: description.start,
    end: description.end,
    line: description.loc.start.line,
  };
}

function printable(value: string): string {
  return JSON.stringify(value).replace(
    /[\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

export function prepareMetadataDescription(
  input: Target & { source: string; newDescription: string },
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
  const before = descriptionLiteral(input.source, input.path);
  if (afterDescription === before.value) {
    invalid("The new description must differ from the existing description.");
  }
  const literal = printable(afterDescription);
  const prefix = input.source.slice(0, before.start);
  const suffix = input.source.slice(before.end);
  const afterSource = prefix + literal + suffix;
  const after = descriptionLiteral(afterSource, input.path);
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
    validationSummary:
      "Validated direct path correspondence, direct metadata export, literal description, no metadata references, reparsed output, and unchanged surrounding source. Human-provided description only.",
  };
}
