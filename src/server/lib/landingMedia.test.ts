import { beforeEach, describe, expect, it, vi } from "vitest";
import { serveLandingMedia } from "./landingMedia";

const FILE = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

function get(name: string, range?: string) {
  return serveLandingMedia(
    name,
    new Request(`https://relay.example/media/${name}`, {
      headers: range ? { range } : {},
    }),
  );
}

describe("serveLandingMedia", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(FILE)),
    );
  });

  it("serves the whole file with its real type", async () => {
    const response = await get("app-demo.mp4");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(FILE);
  });

  it("answers Safari's byte-range probe with 206", async () => {
    const response = await get("app-demo.mp4", "bytes=0-1");
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 0-1/10");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([0, 1]);
  });

  it("serves open-ended and suffix ranges", async () => {
    const tail = await get("app-demo.webm", "bytes=7-");
    expect(tail.headers.get("content-range")).toBe("bytes 7-9/10");
    const last = await get("app-demo.webm", "bytes=-3");
    expect(last.headers.get("content-range")).toBe("bytes 7-9/10");
  });

  it("rejects a range past the end", async () => {
    const response = await get("app-demo.mp4", "bytes=20-30");
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */10");
  });

  it("only serves allow-listed files", async () => {
    const response = await get("..%2Fsecrets.json");
    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });
});
