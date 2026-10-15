import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/client/features/landing/LandingPage";
import landingCss from "@/client/features/landing/landing.css?url";
import { landingFontPreload } from "@/client/features/landing/landingFont";
import { publicPageHead, RELAY_ORIGIN } from "@/lib/relay-seo";

const TITLE = "Relay · Rank higher on Google. Your agent ships the SEO fixes.";
const DESCRIPTION =
  "SEO toolkit: Search Console opportunities, keyword research, rank tracking, audits and AI visibility, built for you and your AI agent.";

// Tells search engines what Relay is, who makes it and what it costs. The
// prices match the pricing section.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Relay",
  url: RELAY_ORIGIN,
  image: `${RELAY_ORIGIN}/android-chrome-512x512.png`,
  description: DESCRIPTION,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  publisher: { "@type": "Organization", name: "Playbook Media LLC" },
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Base", price: "10", priceCurrency: "USD" },
  ],
};

export const Route = createFileRoute("/")({
  head: () => {
    const seo = publicPageHead({
      path: "/",
      title: TITLE,
      description: DESCRIPTION,
    });
    return {
      meta: [...seo.meta, { name: "theme-color", content: "#000000" }],
      links: [
        ...seo.links,
        landingFontPreload,
        { rel: "stylesheet", href: landingCss },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(STRUCTURED_DATA),
        },
      ],
    };
  },
  component: LandingPage,
});
