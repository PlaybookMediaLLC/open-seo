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

export function isAllowedPreviewHost(
  host: string,
  projectDomain: string,
  ownerHosts: string[],
) {
  const name = host.toLowerCase();
  return (
    under(name, projectDomain.toLowerCase()) ||
    PLATFORM_SUFFIXES.some((suffix) => name.endsWith(suffix)) ||
    ownerHosts.some((owner) =>
      owner.startsWith("*.")
        ? name.endsWith(owner.slice(1).toLowerCase())
        : name === owner.toLowerCase(),
    )
  );
}
