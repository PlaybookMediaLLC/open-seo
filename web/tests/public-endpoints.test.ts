import { afterEach, beforeEach, expect, it, vi } from "vitest";

const bindings = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("cloudflare:workers", () => ({ env: bindings.value }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
}));
import { Route as subscribeRoute } from "../src/routes/api/subscribe";
import { Route as eventRoute } from "../src/routes/api/event";

type Endpoint = {
  server: {
    handlers: { POST: (input: { request: Request }) => Promise<Response> };
  };
};
const subscribe = (request: Request) =>
  (subscribeRoute as unknown as Endpoint).server.handlers.POST({ request });
const event = (request: Request) =>
  (eventRoute as unknown as Endpoint).server.handlers.POST({ request });
const request = (
  path: string,
  body: string,
  headers: Record<string, string> = {},
) =>
  new Request(`https://openseo.so/api/${path}`, {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": "203.0.113.1",
      ...headers,
    },
  });
const fetchMock = vi.fn();
const limit = vi.fn();
beforeEach(() => {
  vi.stubEnv("DEV", false);
  bindings.value.LOOPS_API_KEY = "server-secret";
  bindings.value.LOOPS_PRODUCT_UPDATES_LIST_ID = undefined;
  bindings.value.TURNSTILE_SECRET_KEY = "production-secret";
  bindings.value.BACKLINK_CHECK_RATE_LIMIT = { limit };
  limit.mockResolvedValue({ success: true });
  fetchMock.mockImplementation(async (url: string) =>
    url.includes("siteverify")
      ? Response.json({
          success: true,
          hostname: "openseo.so",
          action: "newsletter",
        })
      : Response.json({ success: true }),
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("requires verification before subscribing an address", async () => {
  expect(
    (
      await subscribe(
        request("subscribe", JSON.stringify({ email: "reader@example.com" })),
      )
    ).status,
  ).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("rejects tokens issued for a different action", async () => {
  fetchMock.mockResolvedValue(
    Response.json({
      success: true,
      hostname: "openseo.so",
      action: "free_tool",
    }),
  );
  expect(
    (
      await subscribe(
        request(
          "subscribe",
          JSON.stringify({
            email: "reader@example.com",
            turnstileToken: "token",
          }),
        ),
      )
    ).status,
  ).toBe(403);
  expect(fetchMock).toHaveBeenCalledOnce();
});

it("rate limits newsletter requests before calling any provider", async () => {
  limit.mockResolvedValue({ success: false });
  expect(
    (
      await subscribe(
        request(
          "subscribe",
          JSON.stringify({
            email: "reader@example.com",
            turnstileToken: "token",
          }),
        ),
      )
    ).status,
  ).toBe(429);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("subscribes a verified visitor without forwarding the verification token", async () => {
  expect(
    (
      await subscribe(
        request(
          "subscribe",
          JSON.stringify({
            email: "reader@example.com",
            turnstileToken: "token",
          }),
        ),
      )
    ).status,
  ).toBe(200);
  const [url, init] = fetchMock.mock.calls[1];
  expect(url).toBe("https://app.loops.so/api/v1/contacts/create");
  expect(JSON.parse(init.body)).toEqual({
    email: "reader@example.com",
    source: "openseo-waitlist",
  });
});

it("protects the provider request when resubscribing an existing contact", async () => {
  bindings.value.LOOPS_PRODUCT_UPDATES_LIST_ID = "updates";
  fetchMock
    .mockResolvedValueOnce(
      Response.json({
        success: true,
        hostname: "openseo.so",
        action: "newsletter",
      }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 409 }));

  const response = await subscribe(
    request(
      "subscribe",
      JSON.stringify({
        email: "reader@example.com",
        turnstileToken: "token",
      }),
    ),
  );

  expect(response.status).toBe(200);
  const [url, init] = fetchMock.mock.calls[2];
  expect(url).toBe("https://app.loops.so/api/v1/contacts/update");
  expect(JSON.parse(init.body)).toEqual({
    email: "reader@example.com",
    subscribed: true,
    mailingLists: { updates: true },
  });
  expect(init.redirect).toBe("error");
  expect(init.signal).toBeInstanceOf(AbortSignal);
});

it.each([
  ["{", 400],
  [" ".repeat(16_385), 413],
] as const)(
  "rejects invalid or oversized subscription bodies",
  async (body, status) => {
    expect((await subscribe(request("subscribe", body))).status).toBe(status);
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

it("forwards analytics metadata without incoming credentials or forged forwarding headers", async () => {
  const body = JSON.stringify({
    n: "pageview",
    u: "https://openseo.so/",
    d: "openseo.so",
  });
  await event(
    request("event", body, {
      "content-type": "text/plain",
      authorization: "Bearer private-token",
      cookie: "session=private",
      "cf-access-jwt-assertion": "private-jwt",
      "x-api-key": "private-key",
      "x-forwarded-for": "attacker-controlled",
      "user-agent": "test-browser",
    }),
  );
  const [, init] = fetchMock.mock.calls[0];
  expect(Object.fromEntries(new Headers(init.headers))).toEqual({
    "content-type": "application/json",
    "user-agent": "test-browser",
    "x-forwarded-for": "203.0.113.1",
  });
  expect(init.body).toBe(body);
  expect(init.redirect).toBe("error");
});
