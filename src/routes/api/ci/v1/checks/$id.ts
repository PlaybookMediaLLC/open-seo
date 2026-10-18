import { createFileRoute } from "@tanstack/react-router";
import { jsonNoStore } from "@/server/features/growth/internalAuth";
import { getCheck } from "@/server/features/seo-checks/CheckApi";
import { verifyCiToken } from "@/server/features/seo-checks/ciTokens";

// RFC-0010 5.10: the action polls its run until it finishes.
export const Route = createFileRoute("/api/ci/v1/checks/$id")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        const token = await verifyCiToken(request.headers.get("authorization"));
        if (!token) return jsonNoStore({ error: "unauthorized" }, 401);
        const result = await getCheck(token, params.id);
        return jsonNoStore(result.body, result.status);
      },
    },
  },
});
