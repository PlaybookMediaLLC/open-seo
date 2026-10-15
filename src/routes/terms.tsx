import { createFileRoute } from "@tanstack/react-router";
import landingCss from "@/client/features/landing/landing.css?url";
import { landingFontPreload } from "@/client/features/landing/landingFont";
import { LegalPage } from "@/client/features/legal/LegalPage";
import { publicPageHead } from "@/lib/relay-seo";
import { TERMS } from "@/client/features/legal/terms";

export const Route = createFileRoute("/terms")({
  head: () => {
    const seo = publicPageHead({
      path: "/terms",
      title: "Terms of Service · Relay",
      description:
        "The terms that govern your use of Relay, operated by Playbook Media LLC.",
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
  component: () => <LegalPage document={TERMS} />,
});
