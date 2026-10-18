import { afterEach, expect, it, vi } from "vitest";
import { fetchPageTexts } from "./pageTexts";

// RFC-0012 5.4 step 1: what a person can pick on the live page.
vi.mock("@/server/lib/audit/url-policy", () => ({
  normalizeAndValidateStartUrl: async (url: string) => url,
}));
afterEach(() => vi.unstubAllGlobals());

it("lists headings, links, buttons, labels and short paragraphs once each", async () => {
  const html = `<html><head><script>var a = "<h1>Hidden</h1>";</script></head><body>
    <h1>Patient  ownership</h1><p>A short <a href="/x">paragraph</a>.</p>
    <p>${"long ".repeat(80)}</p><button>Book a call</button>
    <label for="e">Work email</label><a href="/y">Book a call</a></body></html>`;
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(html, { headers: { "content-type": "text/html" } }),
  );
  expect(await fetchPageTexts("https://example.com/")).toEqual([
    { kind: "heading", text: "Patient ownership" },
    { kind: "link", text: "paragraph" },
    { kind: "paragraph", text: "A short paragraph." },
    { kind: "button", text: "Book a call" },
    { kind: "label", text: "Work email" },
  ]);
});
