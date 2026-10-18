import { sortBy } from "remeda";
import {
  isNamed,
  parseSource,
  walk,
} from "@/server/features/publishing/metadataSyntax";

// RFC-0011 5.7: the template edit that ends a test. "apply" keeps the
// variant branch of each `inSplitVariant(...) ? variant : current`, "remove"
// keeps the current one, and both drop the import. Parsing reads syntax
// only; any other use of the helper is left for a person to finish.
type Edit = { start: number; end: number; text: string };

const span = (node: { start?: number | null; end?: number | null }) => ({
  start: node.start ?? 0,
  end: node.end ?? 0,
});
const spanOf = (value: unknown) => {
  const start: unknown = value && Reflect.get(Object(value), "start");
  const end: unknown = value && Reflect.get(Object(value), "end");
  return typeof start === "number" && typeof end === "number"
    ? { start, end }
    : null;
};

export function endTemplate(
  source: string,
  path: string,
  action: "apply" | "remove",
): { source: string; problems: string[] } {
  const refuse = (problem: string) => ({ source, problems: [problem] });
  let program: ReturnType<typeof parseSource>;
  try {
    program = parseSource(source, path);
  } catch {
    return refuse(`${path} could not be parsed.`);
  }
  const imports = program.body.filter(
    (statement) =>
      statement.type === "ImportDeclaration" &&
      /(^|\/)relay-split(\/index(\.ts)?)?$/.test(statement.source.value),
  );
  const [declaration] = imports;
  const [specifier] =
    declaration?.type === "ImportDeclaration" ? declaration.specifiers : [];
  if (
    imports.length !== 1 ||
    declaration?.type !== "ImportDeclaration" ||
    declaration.specifiers.length !== 1 ||
    specifier?.type !== "ImportSpecifier" ||
    !isNamed(specifier.imported, "inSplitVariant")
  )
    return refuse(
      `${path} must import only inSplitVariant from relay-split. Finish this change by hand.`,
    );
  const local = specifier.local.name;
  const edits: Edit[] = [];
  let calls = 0;
  walk(program, (node) => {
    if (node.type === "CallExpression" && isNamed(node.callee, local)) calls++;
    if (node.type !== "ConditionalExpression") return;
    const { test, consequent, alternate } = node;
    if (
      !test ||
      typeof test !== "object" ||
      !("type" in test) ||
      test.type !== "CallExpression" ||
      !("callee" in test) ||
      !isNamed(test.callee, local)
    )
      return;
    const kept = spanOf(action === "apply" ? consequent : alternate);
    const whole = spanOf(node);
    if (kept && whole)
      edits.push({ ...whole, text: source.slice(kept.start, kept.end) });
  });
  if (!calls || calls !== edits.length)
    return refuse(
      `${path} uses inSplitVariant outside a "? :" expression. Finish this change by hand.`,
    );
  const importSpan = span(declaration);
  const lineEnd = source[importSpan.end] === "\n" ? 1 : 0;
  edits.push({
    start: importSpan.start,
    end: importSpan.end + lineEnd,
    text: "",
  });
  const ordered = sortBy(edits, [(edit) => edit.start, "desc"]);
  if (
    ordered.some(
      (edit, index) => index > 0 && edit.end > ordered[index - 1].start,
    )
  )
    return refuse(`${path} nests inSplitVariant. Finish this change by hand.`);
  let result = source;
  for (const edit of ordered)
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  return { source: result, problems: [] };
}
