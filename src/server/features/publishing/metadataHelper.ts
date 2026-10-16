import { z } from "zod";
import {
  fieldProperty,
  invalid,
  isNamed,
  parseSource,
  unwrap,
  walk,
  type CallNode,
  type Expression,
  type HelperFile,
  type Program,
  type Statement,
} from "./metadataSyntax";

const HELPER_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

export function helperCall(program: Program, init: Expression) {
  if (init.type !== "CallExpression" || init.callee.type !== "Identifier")
    invalid(
      "Metadata must be a plain object literal or a call to an imported helper.",
    );
  const local = init.callee.name;
  for (const statement of program.body) {
    if (
      statement.type !== "ImportDeclaration" ||
      statement.importKind === "type"
    )
      continue;
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === "ImportSpecifier" &&
        specifier.importKind !== "type" &&
        specifier.local.name === local
      )
        return {
          call: init,
          name:
            specifier.imported.type === "Identifier"
              ? specifier.imported.name
              : specifier.imported.value,
          specifier: statement.source.value,
        };
    }
  }
  invalid("The metadata helper must be a named import.");
}

function normalizePath(path: string) {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part !== "..") parts.push(part);
    else if (!parts.pop())
      invalid("The metadata helper import points outside the repository.");
  }
  return parts.join("/");
}

const tsconfigSchema = z.object({
  compilerOptions: z
    .object({
      baseUrl: z.string().optional(),
      paths: z.record(z.string(), z.array(z.string())).optional(),
    })
    .optional(),
});

/** Repository paths to try, in order, for the helper module of an import. */
export function metadataHelperCandidates(input: {
  specifier: string;
  pagePath: string;
  rootDirectory: string;
  tsconfig?: string;
}): string[] {
  let base: string;
  if (input.specifier.startsWith("./") || input.specifier.startsWith("../")) {
    base = `${input.pagePath.split("/").slice(0, -1).join("/")}/${input.specifier}`;
  } else {
    let options: z.infer<typeof tsconfigSchema>["compilerOptions"];
    try {
      options = tsconfigSchema.parse(
        JSON.parse(input.tsconfig ?? ""),
      ).compilerOptions;
    } catch {
      invalid("Relay could not read tsconfig.json as plain JSON.");
    }
    const alias = Object.entries(options?.paths ?? {}).find(
      ([key]) =>
        key.endsWith("/*") && input.specifier.startsWith(key.slice(0, -1)),
    );
    if (!alias)
      invalid(
        `The import ${input.specifier} is not a relative path or a tsconfig.json path alias.`,
      );
    const [key, targets] = alias;
    if (targets.length !== 1 || !targets[0].endsWith("/*"))
      invalid(
        "The tsconfig.json path alias must have one target ending in /*.",
      );
    base = [
      input.rootDirectory,
      options?.baseUrl ?? ".",
      targets[0].slice(0, -2),
      input.specifier.slice(key.length - 1),
    ].join("/");
  }
  const path = normalizePath(base);
  return [
    ...HELPER_EXTENSIONS.map((extension) => `${path}${extension}`),
    ...HELPER_EXTENSIONS.map((extension) => `${path}/index${extension}`),
  ];
}

// Proves that the helper returns `description` straight from one parameter, so
// changing that call argument changes the description and nothing else.
function helperMapping(helper: HelperFile, name: string) {
  type FunctionNode =
    | Extract<
        Expression,
        { type: "ArrowFunctionExpression" | "FunctionExpression" }
      >
    | Extract<Statement, { type: "FunctionDeclaration" }>;
  let fn: FunctionNode | undefined;
  for (const statement of parseSource(helper.source, helper.path).body) {
    if (statement.type !== "ExportNamedDeclaration") continue;
    const declaration = statement.declaration;
    if (
      declaration?.type === "FunctionDeclaration" &&
      declaration.id?.name === name
    )
      fn = declaration;
    if (
      declaration?.type === "VariableDeclaration" &&
      declaration.kind === "const"
    )
      for (const item of declaration.declarations) {
        const init = item.init && unwrap(item.init);
        if (
          isNamed(item.id, name) &&
          (init?.type === "ArrowFunctionExpression" ||
            init?.type === "FunctionExpression")
        )
          fn = init;
      }
  }
  if (!fn || fn.async || fn.generator)
    invalid(`${helper.path} must export a plain function named ${name}.`);
  const params = fn.params.map((param) =>
    param.type === "Identifier"
      ? param.name
      : invalid("The metadata helper's parameters must be plain names."),
  );
  let returned: Expression | null | undefined = null;
  if (fn.body.type === "BlockStatement") {
    let returns = 0;
    walk(fn.body, (node) => {
      if (node.type === "ReturnStatement") returns++;
    });
    const top = fn.body.body.filter(
      (statement) => statement.type === "ReturnStatement",
    );
    if (returns === 1 && top.length === 1 && top[0].type === "ReturnStatement")
      returned = top[0].argument;
  } else returned = fn.body;
  const object = returned && unwrap(returned);
  if (object?.type !== "ObjectExpression")
    invalid("The metadata helper must return one object literal.");
  const property = fieldProperty(object, "description");
  if (!property) invalid(`${name} must return a description field.`);
  const index =
    property.value.type === "Identifier"
      ? params.indexOf(property.value.name)
      : -1;
  if (index < 0)
    invalid("The description is computed. Relay can only change literal text.");
  const param = params[index];
  const ignored = new Set<unknown>([property.key, property.value]);
  walk(fn.body, (node) => {
    if (node.type === "ObjectProperty" && !node.computed && !node.shorthand)
      ignored.add(node.key);
    if (node.type === "MemberExpression" && !node.computed)
      ignored.add(node.property);
  });
  const lines: true[] = [];
  walk(fn.body, (node) => {
    if (
      (node.type === "AssignmentExpression" && isNamed(node.left, param)) ||
      (node.type === "UpdateExpression" && isNamed(node.argument, param)) ||
      (node.type === "VariableDeclarator" && isNamed(node.id, param))
    )
      invalid(
        "The metadata helper changes the description before it returns it.",
      );
    if (
      isNamed(node, param) &&
      !ignored.has(node) &&
      typeof node.start === "number"
    )
      lines[helper.source.slice(0, node.start).split("\n").length] = true;
  });
  // A sparse array lists the lines in order: flatMap skips the holes.
  return { index, otherLines: lines.flatMap((_, line) => [line]) };
}

export function helperDescription(
  call: CallNode,
  name: string,
  helper: HelperFile,
) {
  const mapping = helperMapping(helper, name);
  if (call.arguments.some((argument) => argument.type === "SpreadElement"))
    invalid("The metadata helper call must not use spread arguments.");
  const argument = call.arguments[mapping.index];
  const value =
    argument?.type === "StringLiteral"
      ? argument.value
      : argument?.type === "TemplateLiteral" &&
          argument.expressions.length === 0
        ? argument.quasis[0].value.cooked
        : undefined;
  if (value == null)
    invalid("The description is computed. Relay can only change literal text.");
  const others = mapping.otherLines.length
    ? ` The same parameter is also used on line${mapping.otherLines.length > 1 ? "s" : ""} ${mapping.otherLines.join(", ")} of ${helper.path}.`
    : "";
  return {
    node: argument,
    value,
    helperNote: `Changes the description argument of ${name} (defined in ${helper.path}).${others}`,
  };
}
