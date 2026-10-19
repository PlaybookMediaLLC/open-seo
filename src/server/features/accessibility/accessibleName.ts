import { Parser } from "htmlparser2";
import type { ElementTarget } from "@/server/features/publishing/elementLocator";

// RFC-0013 5.4 phase 2: the link, button or form field that needs a name,
// found by its most specific literal attribute.
export const NAME_RULES: Record<string, { tags: string[]; extra: string[] }> = {
  "link-name": { tags: ["a", "Link"], extra: ["href"] },
  "button-name": { tags: ["button"], extra: [] },
  label: {
    tags: ["input", "select", "textarea"],
    extra: ["name", "placeholder"],
  },
};

/** The tag and attributes of the first element in a stored snippet. */
export function snippetAttributes(snippet: string) {
  let found: Record<string, string> | null = null;
  const parser = new Parser({
    onopentag(_name, attributes) {
      found ??= attributes;
    },
  });
  parser.write(snippet);
  parser.end();
  return (found ?? {}) as Record<string, string>;
}

/**
 * The element by id, test id, then the rule's own attributes, then the
 * classes of the selector's last part. Null when none is a literal.
 */
export function nameTarget(
  ruleId: string,
  snippet: string,
  selector: string,
): ElementTarget | null {
  const rule = NAME_RULES[ruleId];
  if (!rule) return null;
  const attributes = snippetAttributes(snippet);
  for (const name of ["id", "data-testid", ...rule.extra])
    if (attributes[name])
      return {
        kind: "attribute",
        tags: rule.tags,
        name,
        value: attributes[name],
      };
  // Escaped class names, such as Tailwind's "md\:flex", are left out.
  const last = selector.split(/\s*[\s>+~]\s*/).at(-1) ?? "";
  const classes = [...last.matchAll(/\.((?:[\w-]|\\.)+)/g)]
    .map((match) => match[1])
    .filter((name) => !name.includes("\\"));
  return classes.length
    ? {
        kind: "attribute",
        tags: rule.tags,
        name: "className",
        value: classes.join(" "),
        tokens: true,
      }
    : null;
}
