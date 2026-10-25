import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("self-host preflight CLI", () => {
  it("starts under Node without Vite's import.meta.env", () => {
    const output = execFileSync(
      process.execPath,
      ["--import", "tsx", "scripts/selfhost-preflight.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          AUTH_MODE: "local_noauth",
          OPENSEO_TELEMETRY_DISABLED: "1",
          DO_NOT_TRACK: "1",
        },
      },
    );

    expect(output).toContain("local_noauth — no auth, single admin user");
  });
});
