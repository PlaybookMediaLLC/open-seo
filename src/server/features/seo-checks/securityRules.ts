import type { Finding, Snapshot } from "./seoRules";

// RFC-0015 5.3: the security headers that production sends and the preview
// drops or weakens. Platforms set some headers themselves, so a drop on a
// platform preview host only warns.
const SECURITY_HEADERS = [
  "strict-transport-security",
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "x-frame-options",
] as const;
export type SecurityHeaders = Record<
  (typeof SECURITY_HEADERS)[number],
  string | null
>;

export const readSecurityHeaders = (headers: Headers): SecurityHeaders => ({
  "strict-transport-security": headers.get("strict-transport-security"),
  "content-security-policy": headers.get("content-security-policy"),
  "x-content-type-options": headers.get("x-content-type-options"),
  "referrer-policy": headers.get("referrer-policy"),
  "permissions-policy": headers.get("permissions-policy"),
  "x-frame-options": headers.get("x-frame-options"),
});

const NAMES: Record<(typeof SECURITY_HEADERS)[number], string> = {
  "strict-transport-security": "Strict-Transport-Security",
  "content-security-policy": "Content-Security-Policy",
  "x-content-type-options": "X-Content-Type-Options",
  "referrer-policy": "Referrer-Policy",
  "permissions-policy": "Permissions-Policy",
  "x-frame-options": "X-Frame-Options",
};

const maxAge = (hsts: string | null) =>
  Number(/max-age\s*=\s*"?(\d+)/i.exec(hsts ?? "")?.[1] ?? Number.NaN);

/** The sources of one CSP directive, with default-src as its fallback. */
function sources(csp: string | null, directive: string) {
  const directives = new Map(
    (csp ?? "").split(";").flatMap((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return name ? [[name.toLowerCase(), values] as const] : [];
    }),
  );
  return directives.get(directive) ?? directives.get("default-src") ?? null;
}

const framed = (headers: SecurityHeaders) =>
  Boolean(headers["x-frame-options"]) ||
  (sources(headers["content-security-policy"], "frame-ancestors")?.length ??
    0) > 0;

export function compareSecurity(
  base: Snapshot,
  preview: Snapshot,
  context: { path: string; platformPreview: boolean },
): Finding[] {
  const before = base.security;
  const after = preview.security;
  if (!before || !after) return [];
  const finding = (
    rule: string,
    severity: Finding["severity"],
    values: [string | null, string | null],
    message: string,
  ): Finding => ({
    path: context.path,
    rule,
    pack: "security",
    severity,
    before: values[0],
    after: values[1],
    message,
  });
  const dropped = context.platformPreview ? "warning" : "blocking";
  const findings: Finding[] = [];
  for (const header of SECURITY_HEADERS) {
    if (header === "x-frame-options") continue;
    if (before[header] && !after[header])
      findings.push(
        finding(
          "security-header-dropped",
          dropped,
          [`${NAMES[header]}: ${before[header]}`, null],
          `The preview drops the ${NAMES[header]} header that production sends.`,
        ),
      );
  }
  if (framed(before) && !framed(after))
    findings.push(
      finding(
        "frame-protection-dropped",
        dropped,
        [
          before["x-frame-options"]
            ? `X-Frame-Options: ${before["x-frame-options"]}`
            : "frame-ancestors",
          null,
        ],
        "The preview drops the protection against framing (X-Frame-Options or CSP frame-ancestors).",
      ),
    );
  const ageBefore = maxAge(before["strict-transport-security"]);
  const ageAfter = maxAge(after["strict-transport-security"]);
  if (ageAfter < ageBefore)
    findings.push(
      finding(
        "hsts-weaker",
        "warning",
        [`max-age=${ageBefore}`, `max-age=${ageAfter}`],
        "The preview sends a shorter HSTS max-age than production.",
      ),
    );
  const inline = (headers: SecurityHeaders) =>
    sources(headers["content-security-policy"], "script-src")?.includes(
      "'unsafe-inline'",
    ) ?? false;
  if (
    after["content-security-policy"] &&
    inline(after) &&
    before["content-security-policy"] &&
    !inline(before)
  )
    findings.push(
      finding(
        "csp-unsafe-inline",
        "warning",
        [null, "script-src 'unsafe-inline'"],
        "The preview adds 'unsafe-inline' to script-src, which lets injected scripts run.",
      ),
    );
  return findings;
}
