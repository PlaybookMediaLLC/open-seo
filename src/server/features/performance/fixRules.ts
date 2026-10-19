// RFC-0014 5.5: the rules that decide whether Relay may change an element.

/**
 * The next/image prop that asks the browser to load the image first:
 * `priority` in Next.js 13 to 15, `preload` from Next.js 16. Null when the
 * installed version is unknown or older.
 */
export function priorityProp(nextVersion: string | undefined) {
  const major = Number(/^[\^~>=v ]*(\d+)\./.exec(nextVersion ?? "")?.[1]);
  if (!Number.isInteger(major) || major < 13) return null;
  return major >= 16 ? "preload" : "priority";
}

// Analytics, chat and tag manager hosts that can load after the page.
const LISTED_SCRIPT_HOSTS = new Set([
  "www.googletagmanager.com",
  "www.google-analytics.com",
  "connect.facebook.net",
  "static.hotjar.com",
  "widget.intercom.io",
  "js.hs-scripts.com",
  "embed.tawk.to",
  "client.crisp.chat",
  "cdn.segment.com",
  "snap.licdn.com",
  "analytics.tiktok.com",
  "www.clarity.ms",
]);

/** True only for a script on the reviewed list of hosts. */
export function isListedScript(src: string) {
  return LISTED_SCRIPT_HOSTS.has(URL.parse(src)?.hostname ?? "");
}
