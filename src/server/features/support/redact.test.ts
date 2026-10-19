import { expect, it } from "vitest";
import { redact } from "./redact";

// RFC-0017 5.4 step 3: seeded personal data never survives redaction.
it("removes emails, phone numbers, token URLs and the requester's name", () => {
  expect(
    redact(
      "ada-l here (Ada.Lovelace@example.co.uk, +44 20 7946 0958). See https://app.example.com/reset?token=abc123 — fails since 2026-10-19 on v1.2.3, ping @ada-l",
      ["ada-l"],
    ),
  ).toBe(
    "[name] here ([email], [phone]). See [url] — fails since 2026-10-19 on v1.2.3, ping [name]",
  );
});
