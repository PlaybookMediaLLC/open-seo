import { ConfigProvider, Effect } from "effect";
import { expect, it } from "vitest";
import { relayObservability } from "./relay-env.ts";

const base = { enabled: true, traces: { enabled: true } };
const deploy = (env: Record<string, string>) =>
  Effect.runSync(
    Effect.provide(
      relayObservability(base),
      ConfigProvider.layer(ConfigProvider.fromUnknown(env)),
    ),
  );

it("keeps the upstream settings when both switches are off", () => {
  expect(deploy({})).toEqual(base);
});

it("exports 1% of traces, and logs only on their own switch", () => {
  // Logs can quote customer content, so traces alone must not turn them on.
  expect(deploy({ OTEL_ENABLED: "true" })).toEqual({
    enabled: true,
    traces: {
      enabled: true,
      headSamplingRate: 0.01,
      destinations: ["axiom-traces"],
    },
  });
  expect(deploy({ OTEL_LOGS_ENABLED: "true" })).toEqual({
    ...base,
    logs: {
      enabled: true,
      invocationLogs: true,
      headSamplingRate: 0.01,
      destinations: ["axiom-logs"],
    },
  });
});

it("stops the deploy on a sample rate outside 0 to 1", () => {
  expect(() =>
    deploy({ OTEL_ENABLED: "true", OTEL_SAMPLING_RATE: "2" }),
  ).toThrow(/OTEL_SAMPLING_RATE/);
});
