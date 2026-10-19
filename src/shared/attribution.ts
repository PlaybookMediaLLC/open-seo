// RFC-0016 5.2: first-touch attribution. Open source, no dependencies, so a
// site can copy this file. The client part writes one first-party cookie,
// once, after consent where the site requires it; the server part turns
// the cookie into Stripe metadata. No personal data is read or stored.
const FIRST_TOUCH_COOKIE = "relay_ft";
const MAX_AGE_SECONDS = 90 * 86_400;
const LIMIT = 200;

type Touch = {
  p: string;
  r: string;
  s: string;
  m: string;
  c: string;
  t: string;
};

/** The cookie value for the first page view of a visit. */
function firstTouchValue(
  location: { pathname: string; search: string; hostname: string },
  referrer: string,
  now: Date,
) {
  const query = new URLSearchParams(location.search);
  const host = URL.parse(referrer)?.hostname ?? "";
  const touch: Touch = {
    p: location.pathname.slice(0, LIMIT),
    // A link from the same site is not a referrer.
    r: host === location.hostname ? "" : host.slice(0, LIMIT),
    s: (query.get("utm_source") ?? "").slice(0, LIMIT),
    m: (query.get("utm_medium") ?? "").slice(0, LIMIT),
    c: (query.get("utm_campaign") ?? "").slice(0, LIMIT),
    t: now.toISOString(),
  };
  return encodeURIComponent(JSON.stringify(touch));
}

/**
 * Records the first touch on the first page view. It never overwrites an
 * existing cookie. With `consentRequired`, it waits for `grantConsent()`.
 */
export function startAttribution(options: { consentRequired: boolean }) {
  let consent = !options.consentRequired;
  const record = () => {
    if (!consent) return;
    if (
      document.cookie
        .split("; ")
        .some((cookie) => cookie.startsWith(`${FIRST_TOUCH_COOKIE}=`))
    )
      return;
    document.cookie = `${FIRST_TOUCH_COOKIE}=${firstTouchValue(location, document.referrer, new Date())}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax; Secure`;
  };
  record();
  return {
    grantConsent() {
      consent = true;
      record();
    },
  };
}

/**
 * The Stripe metadata for a checkout or a new customer, from the request's
 * Cookie header. Empty when the visitor has no first touch.
 */
export function relayAttributionMetadata(cookieHeader: string | null) {
  const raw = (cookieHeader ?? "")
    .split(/;\s*/)
    .find((cookie) => cookie.startsWith(`${FIRST_TOUCH_COOKIE}=`))
    ?.slice(FIRST_TOUCH_COOKIE.length + 1);
  if (!raw) return {};
  let touch: Partial<Touch>;
  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw));
    if (!value || typeof value !== "object") return {};
    touch = value;
  } catch {
    return {};
  }
  const text = (value: unknown) =>
    typeof value === "string" ? value.slice(0, LIMIT) : "";
  return {
    relay_ft_path: text(touch.p),
    relay_ft_referrer: text(touch.r),
    relay_ft_source: text(touch.s) || text(touch.r),
    relay_ft_medium: text(touch.m),
    relay_ft_campaign: text(touch.c),
    relay_ft_at: text(touch.t),
  };
}

// RFC-0016 5.5: the channel of a first touch.
const CHANNELS = [
  "organic_search",
  "paid",
  "email",
  "referral",
  "direct",
  "unknown",
] as const;
type Channel = (typeof CHANNELS)[number];
const SEARCH_ENGINES = [
  /(^|\.)google\.[a-z.]+$/,
  /(^|\.)bing\.com$/,
  /(^|\.)duckduckgo\.com$/,
  /(^|\.)yahoo\.[a-z.]+$/,
  /(^|\.)ecosia\.org$/,
  /(^|\.)search\.brave\.com$/,
];

export function channelOf(
  metadata: Partial<Record<string, string>> | null,
): Channel {
  if (!metadata?.relay_ft_at) return "unknown";
  const medium = (metadata.relay_ft_medium ?? "").toLowerCase();
  const referrer = (metadata.relay_ft_referrer ?? "").toLowerCase();
  if (["cpc", "ppc", "paid", "paidsearch"].includes(medium)) return "paid";
  if (medium === "email") return "email";
  if (
    (!medium || medium === "organic") &&
    SEARCH_ENGINES.some((engine) => engine.test(referrer))
  )
    return "organic_search";
  if (referrer) return "referral";
  if (!metadata.relay_ft_source && !medium && !metadata.relay_ft_campaign)
    return "direct";
  return "referral";
}
