import { expect, it, vi } from "vitest";
import { readRequestText } from "./request-body";

it("cancels oversized chunked bodies before reading the remainder", async () => {
  const cancel = vi.fn();
  const pull = vi.fn(
    (controller: ReadableStreamDefaultController<Uint8Array>) => {
      controller.enqueue(new Uint8Array(9));
    },
  );
  const request = new Request("https://example.com", {
    method: "POST",
    body: new ReadableStream({ pull, cancel }, { highWaterMark: 0 }),
    duplex: "half",
  } as RequestInit);
  expect(await readRequestText(request, 8)).toBeNull();
  expect(cancel).toHaveBeenCalledOnce();
  expect(pull).toHaveBeenCalledOnce();
});

it("limits bytes, not UTF-16 characters", async () => {
  const request = new Request("https://example.com", {
    method: "POST",
    body: "éé",
  });
  expect(await readRequestText(request, 3)).toBeNull();
});

it("preserves the exact body for signature verification", async () => {
  const body = ' { "name": "é" }\n';
  const request = new Request("https://example.com", { method: "POST", body });
  expect(
    await readRequestText(request, new TextEncoder().encode(body).length),
  ).toBe(body);
});
