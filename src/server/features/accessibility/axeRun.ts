import type { BrowserRun } from "@cloudflare/workers-types";
import { Parser } from "htmlparser2";
import { z } from "zod";
import { sha256Hex } from "@/server/lib/audit/ids";
import { isCrawlableUrl } from "@/server/lib/audit/url-policy";

// RFC-0013 5.2: axe-core runs inside the rendered page. A small script
// writes the compact result into a <template>, and Relay reads it back from
// the page's HTML. The page's own scripts never run in the worker.
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
// The pinned axe-core build: jsDelivr's copy of the npm file, checked against
// its SHA-256 before use. Bundling the 570 KB source as a string exhausts the
// build's memory.
const AXE_URL = "https://cdn.jsdelivr.net/npm/axe-core@4.13.0/axe.min.js";
const AXE_SHA256 =
  "c24f097bd2f451d4f933e8bc7d8d539f8672a2ebcb5cc9f9f3eec8ca9470a0c1";
/** The pinned axe-core source, or null when it cannot be loaded or checked. */
export async function loadAxe() {
  try {
    const response = await fetch(AXE_URL, {
      signal: AbortSignal.timeout(15_000),
    });
    const source = await response.text();
    return response.ok && (await sha256Hex(source)) === AXE_SHA256
      ? source
      : null;
  } catch {
    return null;
  }
}
const RESULT_ID = "relay-axe-results";
const MAX_NODES_PER_RULE = 20;
const RENDER_TIMEOUT_MS = 20_000;
const AXE_TIMEOUT_MS = 30_000;

const RUNNER = `(function () {
  function cut(value) { return String(value || "").slice(0, 300); }
  function done(name, value) {
    var el = document.createElement("template");
    el.id = "${RESULT_ID}";
    el.setAttribute(name, value);
    document.documentElement.appendChild(el);
  }
  axe.run(document, { runOnly: { type: "tag", values: ${JSON.stringify(TAGS)} }, resultTypes: ["violations"] }).then(function (r) {
    done("data-json", JSON.stringify({
      version: r.testEngine.version,
      violations: r.violations.map(function (v) {
        return {
          id: v.id,
          impact: v.impact || "minor",
          tags: v.tags.filter(function (t) { return /^wcag/.test(t); }),
          nodes: v.nodes.slice(0, ${MAX_NODES_PER_RULE}).map(function (n) {
            return { target: cut(n.target.join(" ")), html: cut(n.html), summary: cut(n.failureSummary) };
          })
        };
      })
    }));
  }, function (e) { done("data-error", cut(e && e.message)); });
})();`;

const resultSchema = z.object({
  version: z.string().max(40),
  violations: z.array(
    z.object({
      id: z.string().max(100),
      impact: z.enum(["minor", "moderate", "serious", "critical"]),
      tags: z.array(z.string().max(40)).max(20),
      nodes: z
        .array(
          z.object({
            target: z.string().max(300),
            html: z.string().max(300),
            summary: z.string().max(300),
          }),
        )
        .max(MAX_NODES_PER_RULE),
    }),
  ),
});
type AxeResult = z.infer<typeof resultSchema>;
type Browser = Pick<BrowserRun, "quickAction">;

/**
 * The cluster of one violation (5.2 step 6): the rule, the selector without
 * positions, and the snippet without src, href and id values. The same
 * broken component on 40 pages gives one key.
 */
export function clusterKey(ruleId: string, selector: string, snippet: string) {
  const shape = selector.replace(
    /:nth-(?:last-)?(?:child|of-type)\(\d+\)/g,
    "",
  );
  const html = snippet.replace(
    /\s(src|srcset|href|id)=(?:"[^"]*"|'[^']*'|[^\s>]*)/gi,
    ' $1=""',
  );
  return sha256Hex(JSON.stringify([ruleId, shape, html]));
}

function attributesOf(html: string) {
  let found: Record<string, string> | null = null;
  const parser = new Parser({
    onopentag(name, attributes) {
      if (name === "template" && attributes.id === RESULT_ID)
        found = attributes;
    },
  });
  parser.write(html);
  parser.end();
  return found as Record<string, string> | null;
}

/** One page: the axe-core result, or why there is none. */
export async function runAxe(
  browser: Browser,
  url: string,
  source: string,
): Promise<{ result: AxeResult } | { error: string }> {
  if (!isCrawlableUrl(url)) return { error: "The URL is not allowed." };
  try {
    const response = await browser.quickAction("content", {
      url,
      cacheTTL: 0,
      gotoOptions: { waitUntil: "networkidle2", timeout: RENDER_TIMEOUT_MS },
      addScriptTag: [{ content: source }, { content: RUNNER }],
      waitForSelector: { selector: `#${RESULT_ID}`, timeout: AXE_TIMEOUT_MS },
    });
    if (!response.ok) {
      await response.body?.cancel();
      return { error: `The browser answered ${response.status}.` };
    }
    const body = z
      .object({ result: z.string() })
      .safeParse(await response.json());
    const attributes = body.success ? attributesOf(body.data.result) : null;
    if (!attributes)
      return {
        error:
          "The accessibility check did not finish. The page's security policy may block injected scripts.",
      };
    if (attributes["data-error"] !== undefined)
      return { error: `axe-core failed: ${attributes["data-error"]}` };
    const parsed = resultSchema.safeParse(
      JSON.parse(attributes["data-json"] ?? "null"),
    );
    return parsed.success
      ? { result: parsed.data }
      : { error: "The accessibility result could not be read." };
  } catch {
    // Provider errors can hold page data; nothing raw is stored or logged.
    return { error: "The browser could not render the page." };
  }
}
