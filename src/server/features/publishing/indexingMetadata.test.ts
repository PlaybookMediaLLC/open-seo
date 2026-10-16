import { describe, expect, it } from "vitest";
import { prepareIndexingChange } from "./indexingMetadata";

const page =
  "export const metadata = {\n  alternates: { canonical: '/pricing' },\n  robots: { index: true, follow: true },\n};\n";
const change = (
  overrides: Partial<Parameters<typeof prepareIndexingChange>[0]>,
) =>
  prepareIndexingChange({
    path: "app/pricing/page.tsx",
    url: "https://example.com/pricing",
    rootDirectory: "",
    source: page,
    ...overrides,
  });

describe("canonical and robots changes", () => {
  it("changes the canonical URL and the robots literals and nothing else", () => {
    const result = change({
      newCanonical: "https://example.com/plans",
      newRobots: { index: false, follow: true },
    });
    expect(result.afterSource).toBe(
      'export const metadata = {\n  alternates: { canonical: "https://example.com/plans" },\n  robots: { index: false, follow: true },\n};\n',
    );
    expect(result).toMatchObject({
      canonicalBefore: "/pricing",
      canonicalAfter: "https://example.com/plans",
      robotsBefore: "index, follow",
      robotsAfter: "noindex, follow",
    });
  });

  it.each([
    [
      { source: "export const metadata = pageMetadata('Pricing');" },
      { newCanonical: "/plans" },
      "Relay changes canonical and robots only in a literal metadata object.",
    ],
    [
      {
        source:
          "export const metadata = { alternates: { canonical: base + '/x' } };",
      },
      { newCanonical: "/plans" },
      "The canonical URL must be literal text in alternates.",
    ],
    [
      { source: "export const metadata = { robots: 'noindex' };" },
      { newRobots: { index: true, follow: true } },
      "Relay changes only robots: { index, follow } with true or false.",
    ],
    [
      {},
      { newCanonical: "http://example.com/plans" },
      "The canonical URL must be a path such as /pricing or an https:// URL.",
    ],
    [
      {},
      { newRobots: { index: true, follow: true } },
      "The new robots value must differ from the existing one.",
    ],
  ])("refuses %j %j", (source, values, message) => {
    expect(() => change({ ...source, ...values })).toThrowError(
      expect.objectContaining({ code: "VALIDATION_ERROR", message }),
    );
  });
});
