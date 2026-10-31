import { expect, it, vi } from "vitest";
import { GoogleMapsService } from "./GoogleMapsService";

// Traces record outbound URLs, so a key in the query string would reach Axiom.
// An upstream merge can bring back `?key=` without any visible failure.
it("sends the API key in a header, never in the URL", async () => {
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "maps-key");
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({
        session: "session-token",
        expiry: String(Math.floor(Date.now() / 1000) + 3600),
        tileWidth: 256,
        tileHeight: 256,
      }),
    )
    .mockResolvedValueOnce(
      new Response("png", { headers: { "Content-Type": "image/png" } }),
    );
  vi.stubGlobal("fetch", fetchMock);

  await GoogleMapsService.getTile(1, 0, 0);

  expect(fetchMock).toHaveBeenCalledTimes(2);
  for (const call of fetchMock.mock.calls) {
    const request = new Request(...call);
    expect(new URL(request.url).searchParams.has("key")).toBe(false);
    expect(request.headers.get("X-Goog-Api-Key")).toBe("maps-key");
  }
  // createSession keeps its own JSON content type.
  const sessionInit = fetchMock.mock.calls[0]?.[1];
  expect(new Headers(sessionInit?.headers).get("Content-Type")).toBe(
    "application/json",
  );
});
