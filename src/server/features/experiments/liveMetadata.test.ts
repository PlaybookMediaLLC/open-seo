import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLiveMetadata, parseLiveMetadata } from "./liveMetadata";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("live page metadata", () => {
  it("reads the title and description in any attribute order, with entities", () => {
    expect(
      parseLiveMetadata(
        `<head><title>Plans &amp; pricing |  Example</title>
        <meta content='Choose a plan &#8212; today.' name="description" /></head>`,
      ),
    ).toEqual({
      title: "Plans & pricing | Example",
      description: "Choose a plan — today.",
    });
  });

  it("refuses a private address before any request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(fetchLiveMetadata("http://127.0.0.1/admin")).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
