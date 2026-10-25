import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { usePrivacyChoices } from "./PrivacyChoices";

vi.mock("@/lib/auth-client", () => ({
  authClient: {},
  useSession: () => ({ data: null }),
}));
vi.mock("@/lib/auth-mode", () => ({ isHostedClientAuthMode: () => true }));
vi.mock("@/client/lib/posthog", () => ({}));

it("renders public pages without browser cookies or enabling optional tracking", () => {
  function Choices() {
    return createElement("span", null, JSON.stringify(usePrivacyChoices()));
  }

  expect(
    renderToString(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(Choices),
      ),
    ),
  ).toBe("<span>null</span>");
});
