import { expect, it } from "vitest";
import { readSecurityHeaders, compareSecurity } from "./securityRules";
import type { Snapshot } from "./seoRules";

// RFC-0015 5.3: dropped or weaker headers on the preview.
const snapshot = (headers: Record<string, string>): Snapshot => ({
  status: 200,
  redirected: false,
  robotsHeader: null,
  security: readSecurityHeaders(new Headers(headers)),
  page: null,
});
const production = snapshot({
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "content-security-policy": "script-src 'self'; frame-ancestors 'none'",
  "referrer-policy": "strict-origin-when-cross-origin",
});
const rules = (preview: Snapshot, platformPreview = false) =>
  compareSecurity(production, preview, { path: "/", platformPreview }).map(
    (finding) => [finding.rule, finding.severity],
  );

it("blocks a dropped header on a custom-domain preview, and warns on a platform host", () => {
  const preview = snapshot({
    "strict-transport-security": "max-age=63072000; includeSubDomains",
    "content-security-policy": "script-src 'self'; frame-ancestors 'none'",
  });
  expect(rules(preview)).toEqual([["security-header-dropped", "blocking"]]);
  expect(rules(preview, true)).toEqual([
    ["security-header-dropped", "warning"],
  ]);
});

it("warns on a shorter HSTS max-age and on a new 'unsafe-inline' in script-src", () => {
  expect(
    rules(
      snapshot({
        "strict-transport-security": "max-age=300",
        "content-security-policy":
          "script-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
        "referrer-policy": "strict-origin-when-cross-origin",
      }),
    ),
  ).toEqual([
    ["hsts-weaker", "warning"],
    ["csp-unsafe-inline", "warning"],
  ]);
});

it("finds the dropped frame protection, and nothing when the headers match", () => {
  expect(
    rules(
      snapshot({
        "strict-transport-security": "max-age=63072000; includeSubDomains",
        "content-security-policy": "script-src 'self'",
        "referrer-policy": "strict-origin-when-cross-origin",
      }),
    ),
  ).toEqual([["frame-protection-dropped", "blocking"]]);
  expect(rules(production)).toEqual([]);
});
