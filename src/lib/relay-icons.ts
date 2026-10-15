/**
 * Playbook fork: Relay's browser and home-screen icons, mounted in the root
 * route at a `// playbook-seam` line. The `v` query makes browsers drop icons
 * they cached before the R mark replaced the old logo.
 */
const V = "?v=2";

export const relayIconLinks = [
  { rel: "icon", type: "image/svg+xml", href: `/favicon.svg${V}` },
  {
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
    href: `/favicon-32x32.png${V}`,
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "16x16",
    href: `/favicon-16x16.png${V}`,
  },
  { rel: "icon", type: "image/x-icon", href: `/favicon.ico${V}` },
  {
    rel: "apple-touch-icon",
    sizes: "180x180",
    href: `/apple-touch-icon.png${V}`,
  },
  { rel: "manifest", href: "/site.webmanifest" },
];
