import { parse } from "@babel/parser";
import { AppError } from "@/server/lib/errors";

// Shared syntax helpers for the metadata parser. Nothing here executes code.
export type HelperFile = { path: string; source: string };

export type Program = ReturnType<typeof parse>["program"];

export type Statement = Program["body"][number];

export type Expression = Extract<
  Statement,
  { type: "ExpressionStatement" }
>["expression"];

type ObjectNode = Extract<Expression, { type: "ObjectExpression" }>;

export type CallNode = Extract<Expression, { type: "CallExpression" }>;

export function invalid(message: string): never {
  throw new AppError("VALIDATION_ERROR", message);
}

export function unwrap(expression: Expression): Expression {
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
export function walk(
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

export function parseSource(source: string, path: string) {
  try {
    return parse(source, {
      sourceType: "module",
      plugins: [
        ...(/\.tsx?$/.test(path) ? ["typescript" as const] : []),
        ...(!path.endsWith(".ts") ? ["jsx" as const] : []),
      ],
    }).program;
  } catch {
    invalid("Metadata source could not be parsed safely.");
  }
}

export function isNamed(value: unknown, name: string): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "Identifier" &&
    "name" in value &&
    value.name === name
  );
}

// The one property named `field`, rejecting shapes that could hide or override it.
export function fieldProperty(object: ObjectNode, field: string) {
  let found:
    | Extract<ObjectNode["properties"][number], { type: "ObjectProperty" }>
    | undefined;
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
    if (key !== field) {
      if (property.type === "ObjectMethod" || key === "__proto__") {
        invalid("Metadata methods and custom prototypes are not supported.");
      }
      continue;
    }
    if (found) invalid(`Metadata must not contain duplicate ${field} keys.`);
    if (property.type !== "ObjectProperty")
      invalid(`Metadata ${field} must be an existing string literal.`);
    found = property;
  }
  return found;
}
