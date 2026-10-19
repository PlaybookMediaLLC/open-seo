import { ACCESSIBILITY_LIMITS } from "./accessibility";

// RFC-0013 5.7 phase 3: an accessibility statement draft from stored facts
// only: the last checked audit, the target standard, the open issues as
// known limitations, and the contact the owner enters. The owner edits and
// publishes it. It never claims that the site complies.
export type StatementFacts = {
  site: string;
  checkedAt: string;
  pagesChecked: number;
  rules: Array<{
    ruleId: string;
    impact: "minor" | "moderate" | "serious" | "critical";
    pages: number;
  }>;
};

const RULES: Record<string, string> = {
  "image-alt": "Images without alternative text",
  "html-has-lang": "Pages without a page language",
  "html-lang-valid": "Pages with an invalid page language",
  "link-name": "Links without a name",
  "button-name": "Buttons without a name",
  label: "Form fields without a label",
  "color-contrast": "Text with low contrast",
  "heading-order": "Headings that skip a level",
};

const plural = (count: number) => `${count} ${count === 1 ? "page" : "pages"}`;

export function accessibilityStatement(facts: StatementFacts, contact: string) {
  const date = facts.checkedAt.slice(0, 10);
  const host = URL.parse(facts.site)?.host ?? facts.site;
  return [
    `# Accessibility statement for ${host}`,
    `This statement describes the accessibility of ${host}. Our target is the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.`,
    "## How we check",
    `On ${date}, automated checks with axe-core tested ${plural(facts.pagesChecked)} of this site. ${ACCESSIBILITY_LIMITS}`,
    "[Describe your manual testing here, or delete this line.]",
    "## Known limitations",
    facts.rules.length
      ? `The automated checks on ${date} found these issues:\n\n${facts.rules
          .map(
            (rule) =>
              `- ${RULES[rule.ruleId] ?? `axe-core rule ${rule.ruleId}`}: ${plural(rule.pages)} (${rule.impact})`,
          )
          .join("\n")}`
      : `The automated checks on ${date} found no issues on the checked pages.`,
    "## Feedback",
    `If you find a barrier on this site, contact us at ${contact.trim() || "[contact address]"}.`,
  ].join("\n\n");
}
