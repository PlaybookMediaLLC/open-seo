import { expect, it } from "vitest";
import { enabledPacks, gateTrend, parseGateConfig } from "./releaseGate";

// RFC-0015 5.4: the repository file wins, and a mistake is shown exactly.
const defaults = {
  seo: true,
  accessibility: false,
  links: false,
  security: false,
  performance: false,
};

it("lets the repository file switch packs over the project defaults", () => {
  const parsed = parseGateConfig(
    '{"packs":{"seo":false,"accessibility":true,"securityHeaders":true}}',
  );
  expect("config" in parsed && enabledPacks(defaults, parsed.config)).toEqual([
    "accessibility",
    "security",
  ]);
  expect(enabledPacks(defaults, null)).toEqual(["seo"]);
});

it("reports the exact reason an invalid file fails", () => {
  const reason = (text: string) => {
    const parsed = parseGateConfig(text);
    return "error" in parsed ? parsed.error : null;
  };
  expect(
    reason('{"packs":{"seo":"yes"},"ignore":[{"rule":"x","path":"("}]}'),
  ).toMatch(
    /^relay-gate\.json is invalid: packs\.seo: .+; ignore\.0\.path: Use a valid RE2 expression without lookaround or backreferences\.$/,
  );
  expect(reason("{")).toBe("relay-gate.json is not valid JSON.");
  expect(reason('{"extra":1}')).toContain("relay-gate.json is invalid");
});

it("rejects backtracking-only features before saving release-gate rules", () => {
  const parsed = parseGateConfig(
    JSON.stringify({
      ignore: [{ rule: "content-shrunk", path: "^/(a+)\\1$" }],
    }),
  );
  expect("error" in parsed && parsed.error).toContain(
    "without lookaround or backreferences",
  );
});

// RFC-0015 5.7: the trend of blocking findings, oldest run first.
it("draws the blocking findings of the last runs as one line", () => {
  expect(gateTrend([0, 2, 4, 1])).toBe(
    "Blocking findings in the last 4 runs: ▁▅█▃ (0, 2, 4, 1)",
  );
  expect(gateTrend([3])).toBe("");
});
