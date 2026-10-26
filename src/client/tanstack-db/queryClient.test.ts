import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { queryClient } from "@/client/tanstack-db/queryClient";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

function runFailingMutation(
  options: {
    onError?: () => void;
    meta?: { errorToast?: false; errorMessages?: { RATE_LIMITED: string } };
  } = {},
) {
  return queryClient
    .getMutationCache()
    .build(queryClient, {
      mutationFn: () => Promise.reject(new Error("RATE_LIMITED")),
      ...options,
    })
    .execute(undefined)
    .catch(() => undefined);
}

describe("default mutation error toast", () => {
  it("shows the standard message for a mutation without its own handling", async () => {
    await runFailingMutation();
    expect(toast.error).toHaveBeenCalledWith(
      "Too many requests. Please wait and try again.",
    );
  });

  it("prefers the mutation's own copy for that code", async () => {
    await runFailingMutation({
      meta: { errorMessages: { RATE_LIMITED: "Slow down on invites." } },
    });
    expect(toast.error).toHaveBeenCalledWith("Slow down on invites.");
  });

  it("stays quiet when the mutation has its own onError or opts out", async () => {
    await runFailingMutation({ onError: () => undefined });
    await runFailingMutation({ meta: { errorToast: false } });
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("default query retry", () => {
  const retry = queryClient.getDefaultOptions().queries?.retry;
  if (typeof retry !== "function") throw new Error("retry is not a function");

  it("retries failures that can pass on a second try", () => {
    expect(retry(0, new Error("UPSTREAM_UNAVAILABLE"))).toBe(true);
    expect(retry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(retry(3, new Error("INTERNAL_ERROR"))).toBe(false);
  });

  it("does not retry failures that will repeat", () => {
    expect(retry(0, new Error("NOT_FOUND"))).toBe(false);
    expect(retry(0, new Error("DATAFORSEO_NOT_CONFIGURED"))).toBe(false);
  });
});
