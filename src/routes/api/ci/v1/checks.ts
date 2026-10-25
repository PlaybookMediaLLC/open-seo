import { createFileRoute } from "@tanstack/react-router";
import { jsonNoStore } from "@/server/features/growth/internalAuth";
import { createCheck } from "@/server/features/seo-checks/CheckApi";
import { verifyCiToken } from "@/server/features/seo-checks/ciTokens";
import { createCheckInputSchema } from "@/types/schemas/seoChecks";
import { readRequestText } from "@/server/lib/request-body";

// RFC-0010 5.10: the GitHub Action starts a check with its CI token.
const MAX_BODY_BYTES = 64 * 1024;

export const Route = createFileRoute("/api/ci/v1/checks")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const token = await verifyCiToken(request.headers.get("authorization"));
        if (!token)
          return jsonNoStore(
            {
              error: "unauthorized",
              message: "Check the RELAY_CI_TOKEN secret.",
            },
            401,
          );
        const text = await readRequestText(request, MAX_BODY_BYTES);
        if (text === null) return jsonNoStore({ error: "too_large" }, 413);
        let raw: unknown = null;
        try {
          raw = JSON.parse(text);
        } catch {
          return jsonNoStore({ error: "invalid_request" }, 400);
        }
        const parsed = createCheckInputSchema.safeParse(raw);
        if (!parsed.success)
          return jsonNoStore(
            {
              error: "invalid_request",
              message: parsed.error.issues[0]?.message,
            },
            400,
          );
        const result = await createCheck(token, parsed.data);
        return jsonNoStore(result.body, result.status);
      },
    },
  },
});
