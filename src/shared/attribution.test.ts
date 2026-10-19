import { afterEach, describe, expect, it, vi } from "vitest";
import {
  channelOf,
  relayAttributionMetadata,
  startAttribution,
} from "./attribution";

// RFC-0016 5.2 and 5.5: first touch only, after consent, and the channels.
function browser(href: string, referrer: string) {
  const jar = new Map<string, string>();
  const url = new URL(href);
  const written: string[] = [];
  vi.stubGlobal("location", url);
  vi.stubGlobal("document", {
    referrer,
    get cookie() {
      return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    set cookie(text: string) {
      written.push(text);
      const [pair] = text.split("; ");
      const index = pair.indexOf("=");
      jar.set(pair.slice(0, index), pair.slice(index + 1));
    },
  });
  return { jar, written };
}
afterEach(() => vi.unstubAllGlobals());

describe("startAttribution", () => {
  it("writes the first touch once, for 90 days, and never overwrites it", () => {
    const { jar, written } = browser(
      "https://site.example/pricing?utm_source=news&utm_medium=email",
      "https://mail.example/",
    );
    startAttribution({ consentRequired: false });
    expect(written[0]).toMatch(
      /; Max-Age=7776000; Path=\/; SameSite=Lax; Secure$/,
    );
    const first = jar.get("relay_ft");
    vi.stubGlobal("location", new URL("https://site.example/blog"));
    startAttribution({ consentRequired: false });
    expect(jar.get("relay_ft")).toBe(first);
    expect(written).toHaveLength(1);
  });

  it("waits for consent where the site requires it", () => {
    const { jar } = browser("https://site.example/", "");
    const attribution = startAttribution({ consentRequired: true });
    expect(jar.has("relay_ft")).toBe(false);
    attribution.grantConsent();
    expect(jar.has("relay_ft")).toBe(true);
  });
});

it("turns the cookie into Stripe metadata, and ignores a broken cookie", () => {
  const { jar } = browser(
    "https://site.example/pricing?utm_campaign=launch",
    "https://www.google.com/",
  );
  startAttribution({ consentRequired: false });
  const metadata = relayAttributionMetadata(
    `theme=dark; relay_ft=${jar.get("relay_ft")}`,
  );
  expect(metadata).toMatchObject({
    relay_ft_path: "/pricing",
    relay_ft_referrer: "www.google.com",
    relay_ft_source: "www.google.com",
    relay_ft_campaign: "launch",
  });
  expect(relayAttributionMetadata("relay_ft=%7Bbroken")).toEqual({});
  expect(relayAttributionMetadata(null)).toEqual({});
});

describe("channelOf", () => {
  const at = { relay_ft_at: "2026-10-19T00:00:00.000Z" };
  it.each([
    [{ ...at, relay_ft_referrer: "www.google.co.uk" }, "organic_search"],
    [
      { ...at, relay_ft_medium: "cpc", relay_ft_referrer: "www.google.com" },
      "paid",
    ],
    [{ ...at, relay_ft_medium: "email" }, "email"],
    [{ ...at, relay_ft_referrer: "news.ycombinator.com" }, "referral"],
    [at, "direct"],
    [null, "unknown"],
  ] as const)("classifies %o as %s", (metadata, channel) => {
    expect(channelOf(metadata)).toBe(channel);
  });
});
