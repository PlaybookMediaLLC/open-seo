import { MAX_HTML_BYTES, readTextUpTo } from "@/server/lib/audit/html-response";
import { normalizeAndValidateStartUrl } from "@/server/lib/audit/url-policy";

const MAX_REDIRECTS = 3;

const ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
  ["nbsp", " "],
]);

function decode(value: string) {
  return value
    .replace(
      /&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi,
      (_match: string, decimal?: string, hex?: string, name?: string) =>
        decimal || hex
          ? String.fromCodePoint(
              Number.parseInt(decimal ?? hex ?? "", decimal ? 10 : 16),
            )
          : (ENTITIES.get(name?.toLowerCase() ?? "") ?? ""),
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** The rendered `<title>` and meta description, normalized for comparison. */
export function parseLiveMetadata(html: string) {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  let description: string | undefined;
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!/\bname\s*=\s*["']?description["'\s/>]/i.test(tag)) continue;
    const content = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    description = content?.[1] ?? content?.[2];
    break;
  }
  return {
    title: title === undefined ? null : decode(title),
    description: description === undefined ? null : decode(description),
  };
}

// Fetches the live page through the SSRF guard. Every redirect hop is
// validated again. The response is parsed as text and never executed.
export async function fetchLiveMetadata(url: string) {
  let current = await normalizeAndValidateStartUrl(url);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current, {
      headers: {
        "user-agent": "Relay/1.0 (+https://relay.playbookmedia.io)",
        accept: "text/html",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location) return null;
      current = await normalizeAndValidateStartUrl(
        new URL(location, current).toString(),
      );
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    return parseLiveMetadata(await readTextUpTo(response, MAX_HTML_BYTES));
  }
  return null;
}
