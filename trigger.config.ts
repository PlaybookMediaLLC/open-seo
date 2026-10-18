import { defineConfig } from "@trigger.dev/sdk";

// RFC-0008 5.2: Trigger.dev schedules, retries and limits growth jobs; the
// Relay Worker does all data work. Set TRIGGER_PROJECT_REF to the project
// ref from the Trigger.dev dashboard before `trigger.dev deploy`.
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "",
  dirs: ["./trigger"],
  runtime: "node",
  machine: "micro",
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 300_000,
      maxTimeoutInMs: 1_800_000,
      factor: 6,
    },
  },
});
