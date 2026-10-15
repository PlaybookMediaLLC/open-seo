import { createFileRoute } from "@tanstack/react-router";
import landingCss from "@/client/features/landing/landing.css?url";
import { LegalPage } from "@/client/features/legal/LegalPage";
import { TERMS } from "@/client/features/legal/terms";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service · Relay" },
      {
        name: "description",
        content:
          "The terms that govern your use of Relay, operated by Playbook Media LLC.",
      },
      { name: "theme-color", content: "#000000" },
    ],
    links: [{ rel: "stylesheet", href: landingCss }],
  }),
  component: () => <LegalPage document={TERMS} />,
});
