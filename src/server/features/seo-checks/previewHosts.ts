// RFC-0010 5.4: the preview host must be the project's domain or one of its
// subdomains, a known preview platform, or a host that an owner added, so
// Relay is never an open fetch proxy.
const PLATFORM_SUFFIXES = [
  ".vercel.app",
  ".netlify.app",
  ".pages.dev",
  ".workers.dev",
];

/** RFC-0015: a preview on a hosting platform, which sets its own headers. */
export const isPlatformHost = (host: string) =>
  PLATFORM_SUFFIXES.some((suffix) => host.toLowerCase().endsWith(suffix));

const under = (host: string, domain: string) =>
  host === domain || host.endsWith(`.${domain}`);

/**
 * RFC-0010 5.4: the preview access secret goes only to a host the owner
 * vouched for: the project's domain or a subdomain, an exact host they added,
 * or a wildcard they added under one platform account, such as
 * `*.myproj.pages.dev`. `*.vercel.app` covers every Vercel user, so a
 * platform-wide wildcard never counts.
 */
export function isTrustedPreviewHost(
  host: string,
  projectDomain: string,
  ownerHosts: string[],
) {
  const name = host.toLowerCase();
  return (
    under(name, projectDomain.toLowerCase()) ||
    ownerHosts.some((owner) => {
      const pattern = owner.toLowerCase();
      if (!pattern.startsWith("*.")) return name === pattern;
      const suffix = pattern.slice(1);
      return (
        !PLATFORM_SUFFIXES.some((platform) => platform.endsWith(suffix)) &&
        name.endsWith(suffix)
      );
    })
  );
}

/** A host Relay checks: a trusted one, or any platform host without the secret. */
export const isAllowedPreviewHost = (
  host: string,
  projectDomain: string,
  ownerHosts: string[],
) =>
  isPlatformHost(host) || isTrustedPreviewHost(host, projectDomain, ownerHosts);
