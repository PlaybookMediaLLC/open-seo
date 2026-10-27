import { expect, it } from "vitest";
import { isTrustedPreviewHost } from "./previewHosts";

// RFC-0010 5.4: the preview secret must not reach a platform host anyone can claim.
it("trusts only preview hosts the owner vouched for", () => {
  const owner = ["*.vercel.app", "*.myproj.pages.dev"];
  const trusted = (host: string) =>
    isTrustedPreviewHost(host, "example.com", owner);
  expect(trusted("attacker.vercel.app")).toBe(false);
  expect(trusted("attacker.pages.dev")).toBe(false);
  expect(trusted("staging.example.com")).toBe(true);
  expect(trusted("pr-7.myproj.pages.dev")).toBe(true);
});
