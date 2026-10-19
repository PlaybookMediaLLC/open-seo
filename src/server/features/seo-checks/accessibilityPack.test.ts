import { expect, it, vi } from "vitest";
import { checkAccessibility, newViolations } from "./accessibilityPack";

// RFC-0015 5.3: only violations that the pull request adds.
vi.mock("cloudflare:workers", () => ({ env: {} }));
const node = (target: string, html: string) => ({
  target,
  html,
  summary: "Fix: add alt text",
});
const result = (
  violations: Array<{
    id: string;
    impact: "minor" | "moderate" | "serious" | "critical";
    nodes: Array<ReturnType<typeof node>>;
  }>,
) => ({
  version: "4.13.0",
  headings: [],
  violations: violations.map((item) => ({ ...item, tags: ["wcag2a"] })),
});
const logo = node("header > img", '<img src="/logo.png" class="logo">');
const card = node("main > img", '<img src="/card.png" class="card">');

it("blocks a new serious violation, and warns on a moderate one", async () => {
  const base = result([{ id: "image-alt", impact: "critical", nodes: [logo] }]);
  const preview = result([
    { id: "image-alt", impact: "critical", nodes: [logo, card] },
    { id: "heading-order", impact: "moderate", nodes: [node("h4", "<h4>")] },
    { id: "region", impact: "minor", nodes: [node("div", "<div>")] },
  ]);
  expect(
    (await newViolations(base, preview, "/")).map((item) => [
      item.rule,
      item.severity,
    ]),
  ).toEqual([
    ["image-alt", "blocking"],
    ["heading-order", "warning"],
  ]);
});

it("ignores a known element whose class name changed between builds", async () => {
  const base = result([
    {
      id: "image-alt",
      impact: "critical",
      nodes: [node("img", '<img class="a1">')],
    },
  ]);
  const preview = result([
    {
      id: "image-alt",
      impact: "critical",
      nodes: [node("img", '<img class="b2">')],
    },
  ]);
  expect(await newViolations(base, preview, "/")).toEqual([]);
});

it("says once that a protected preview was not checked", async () => {
  const findings = await checkAccessibility(
    {
      runId: "run",
      projectId: "project",
      organizationId: "org",
      baseOrigin: "https://example.com",
      previewOrigin: "https://pr-7.example.com",
      trailingSlash: false,
    },
    ["/", "/pricing"],
    true,
  );
  expect(findings).toEqual([
    expect.objectContaining({
      rule: "accessibility-not-checked",
      severity: "warning",
    }),
  ]);
});
