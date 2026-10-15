import { createFileRoute } from "@tanstack/react-router";
import landingCss from "@/client/features/landing/landing.css?url";
import { landingFontPreload } from "@/client/features/landing/landingFont";
import { LegalPage } from "@/client/features/legal/LegalPage";
import { publicPageHead } from "@/lib/relay-seo";
import { PRIVACY } from "@/client/features/legal/privacy";

export const Route = createFileRoute("/privacy")({
  head: () => {
    const seo = publicPageHead({
      path: "/privacy",
      title: "Privacy Policy · Relay",
      description:
        "How Relay collects, uses and protects your information, including Google user data.",
    });
    return {
      meta: [...seo.meta, { name: "theme-color", content: "#000000" }],
      links: [
        ...seo.links,
        landingFontPreload,
        { rel: "stylesheet", href: landingCss },
      ],
    };
  },
  component: () => <LegalPage document={PRIVACY} />,
});
