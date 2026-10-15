import { ClientOnly, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Playbook fork: upstream renders every page in the browser only. The public
 * pages also render on the server, so search engines and AI crawlers that do
 * not run JavaScript can read them. The app stays browser-only.
 *
 * Mounted in src/routes/__root.tsx at `// playbook-seam` lines.
 */
export function RelayClientOnly({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  return isPublicPath(pathname) ? (
    children
  ) : (
    <ClientOnly>{children}</ClientOnly>
  );
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/docs" ||
    pathname.startsWith("/docs/")
  );
}
