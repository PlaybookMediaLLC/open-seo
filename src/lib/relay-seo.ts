/**
 * Playbook fork: head tags for Relay's public pages. Search engines get a
 * canonical URL; social and chat apps get an Open Graph and Twitter card.
 */
export const RELAY_ORIGIN = "https://relay.playbookmedia.io";

const SOCIAL_IMAGE = `${RELAY_ORIGIN}/og/relay.png`;

export function publicPageHead({
  path,
  title,
  description,
}: {
  path: string;
  title: string;
  description: string;
}) {
  const url = `${RELAY_ORIGIN}${path}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Relay" },
      { property: "og:url", content: url },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:image", content: SOCIAL_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: SOCIAL_IMAGE },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
