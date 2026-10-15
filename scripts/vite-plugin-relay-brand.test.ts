import { describe, expect, it } from "vitest";
import type { ResolvedConfig, TransformResult } from "vite";
import { relayBrand } from "../vite-plugin-relay-brand";

const ROOT = "/home/runner/work/open-seo/open-seo";

function transform(code: string, id: string) {
  const plugin = relayBrand();
  if (typeof plugin.configResolved === "function") {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the hook reads only `root`
    void plugin.configResolved.call(
      {} as never,
      { root: ROOT } as ResolvedConfig,
    );
  }
  if (typeof plugin.transform !== "function") throw new Error("no transform");
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the hook uses no plugin context
  const result = plugin.transform.call(
    {} as never,
    code,
    id,
  ) as TransformResult | null;
  return result && typeof result === "object" ? result.code : null;
}

describe("relayBrand", () => {
  it("rebrands project files outside src/, as CI checkouts have no /src/ in the path", () => {
    expect(
      transform(
        "Set up OpenSEO at https://app.openseo.so/mcp",
        `${ROOT}/.agents/skills/setup-openseo/SKILL.md?raw`,
      ),
    ).toBe("Set up Relay at https://relay.playbookmedia.io/mcp");
  });

  it("leaves dependencies and identifiers alone", () => {
    expect(
      transform("OpenSEO", `${ROOT}/node_modules/pkg/index.js`),
    ).toBeNull();
    expect(transform("isOpenSEOHost()", `${ROOT}/src/lib/host.ts`)).toBeNull();
  });

  it("sends help links to Relay's docs and pricing", () => {
    expect(
      transform(
        '["https://openseo.so/docs/mcp", "https://openseo.so/blogs/google-search-console-setup", "https://openseo.so/pricing?utm_source=chatgpt"]',
        `${ROOT}/src/routes/_app/ai.tsx`,
      ),
    ).toBe(
      '["https://relay.playbookmedia.io/docs/mcp", "https://relay.playbookmedia.io/docs/google-search-console", "https://relay.playbookmedia.io/?utm_source=chatgpt#pricing"]',
    );
  });
});
