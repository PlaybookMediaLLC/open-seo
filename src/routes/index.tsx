import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/client/features/landing/LandingPage";
import landingCss from "@/client/features/landing/landing.css?url";

const DESCRIPTION =
  "SEO toolkit: Search Console opportunities, keyword research, rank tracking, audits and AI visibility, built for you and your AI agent.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Relay · Just ship. Rank faster." },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Relay · Just ship. Rank faster." },
      { property: "og:description", content: DESCRIPTION },
      { name: "theme-color", content: "#000000" },
    ],
    links: [{ rel: "stylesheet", href: landingCss }],
  }),
  component: LandingPage,
});
