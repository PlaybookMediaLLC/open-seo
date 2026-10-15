import { createFileRoute } from "@tanstack/react-router";
import landingCss from "@/client/features/landing/landing.css?url";
import { LegalPage } from "@/client/features/legal/LegalPage";
import { PRIVACY } from "@/client/features/legal/privacy";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · Relay" },
      {
        name: "description",
        content:
          "How Relay collects, uses and protects your information, including Google user data.",
      },
      { name: "theme-color", content: "#000000" },
    ],
    links: [{ rel: "stylesheet", href: landingCss }],
  }),
  component: () => <LegalPage document={PRIVACY} />,
});
