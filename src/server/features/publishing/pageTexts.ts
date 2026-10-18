import { Parser } from "htmlparser2";
import { readTextUpTo } from "@/server/lib/audit/html-response";
import { normalizeAndValidateStartUrl } from "@/server/lib/audit/url-policy";
import { AppError } from "@/server/lib/errors";

// RFC-0012 5.4 step 1: the texts a person can pick on the live page. It uses
// the same streaming parser as the page analyzer, and runs no page script.
const USER_AGENT = "RelayCopy/1.0 (+https://relay.playbookmedia.io/docs)";
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PARAGRAPH = 300;
const MAX_TEXTS = 100;
const BLOCKS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "a",
  "button",
  "label",
]);
const SKIPPED = new Set(["script", "style", "noscript", "svg", "template"]);
type PageText = { kind: string; text: string };

export const normalizeText = (text: string) => text.replace(/\s+/g, " ").trim();

/** Headings, links, buttons, form labels and short paragraphs, in order. */
function extractTexts(html: string): PageText[] {
  const texts: PageText[] = [];
  const seen = new Set<string>();
  const open: Array<{ kind: string; parts: string[] }> = [];
  let skipped = 0;
  const parser = new Parser(
    {
      onopentag(name) {
        if (SKIPPED.has(name)) skipped++;
        else if (BLOCKS.has(name)) open.push({ kind: name, parts: [] });
      },
      ontext(text) {
        if (!skipped) for (const block of open) block.parts.push(text);
      },
      onclosetag(name) {
        if (SKIPPED.has(name)) {
          skipped = Math.max(0, skipped - 1);
          return;
        }
        if (!BLOCKS.has(name)) return;
        const index = open.map((block) => block.kind).lastIndexOf(name);
        if (index < 0) return;
        const [block] = open.splice(index, 1);
        const text = normalizeText(block.parts.join(""));
        const kind = /^h\d$/.test(name) ? "heading" : name;
        if (
          !text ||
          (name === "p" && text.length > MAX_PARAGRAPH) ||
          seen.has(text) ||
          texts.length >= MAX_TEXTS
        )
          return;
        seen.add(text);
        texts.push({
          kind: { a: "link", p: "paragraph" }[kind] ?? kind,
          text,
        });
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();
  return texts;
}

/** One request to the live page. A redirect is not followed. */
export async function fetchPageTexts(url: string) {
  await normalizeAndValidateStartUrl(url);
  const response = await fetch(url, {
    redirect: "manual",
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (
    response.status !== 200 ||
    !response.headers.get("content-type")?.includes("text/html")
  ) {
    await response.body?.cancel();
    throw new AppError(
      "CONFLICT",
      `The live page answered ${response.status}. Relay reads text only from a page that answers 200 with HTML.`,
    );
  }
  return extractTexts(await readTextUpTo(response, MAX_BYTES));
}
