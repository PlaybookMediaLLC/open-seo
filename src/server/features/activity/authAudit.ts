import { createAuthMiddleware } from "better-auth/api";
import { AuthRepository } from "@/server/auth/repositories/AuthRepository";
import { recordAudit, type AuditAction } from "./auditLog";

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null
    ? Reflect.get(value, key)
    : undefined;
const text = (value: unknown) =>
  typeof value === "string" && value ? value : null;

type Session = { session: unknown; user: { id: string } };

// RFC-0009 5.6: member removal and API key changes run in better-auth's
// own endpoints. This after hook records them once they succeed, in the
// organization the endpoint acted on. Never the request body's
// organizationId: /api-key/create accepts one without checking it.
const ROUTES: Record<
  string,
  {
    action: AuditAction;
    summary: string;
    organizationId: (
      returned: unknown,
      session: Session,
    ) => Promise<string | null> | string | null;
  }
> = {
  "/organization/remove-member": {
    action: "member.removed",
    summary: "Removed a member",
    // Better Auth checked the caller's membership and permission here.
    organizationId: (returned) =>
      text(field(field(returned, "member"), "organizationId")),
  },
  "/api-key/create": {
    action: "api_key.created",
    summary: "Created an API key",
    // The before hook in lib/auth.ts stamps the verified active org here.
    organizationId: (returned) =>
      text(field(field(returned, "metadata"), "organizationId")),
  },
  "/api-key/delete": {
    action: "api_key.deleted",
    summary: "Deleted an API key",
    // Returns only { success }. The key was the caller's own; log it in
    // their active org if they still belong to it.
    organizationId: async (_returned, session) => {
      const active = text(field(session.session, "activeOrganizationId"));
      return active &&
        (await AuthRepository.getMembership(session.user.id, active))
        ? active
        : null;
    },
  },
};

export const auditAuthRoute = createAuthMiddleware(async (ctx) => {
  const route = ROUTES[ctx.path];
  const returned: unknown = ctx.context.returned;
  const session = ctx.context.session;
  if (!route || !session || returned instanceof Error) return;
  const body: unknown = ctx.body;
  const organizationId = await route.organizationId(returned, session);
  if (!organizationId) return;
  await recordAudit({
    organizationId,
    projectId: null,
    actor: { userId: session.user.id },
    action: route.action,
    targetType: route.action.startsWith("member") ? "member" : "api_key",
    // The member id, never the email that a removal may name.
    targetId:
      text(field(field(returned, "member"), "id")) ??
      text(field(body, "keyId")) ??
      text(field(returned, "id")) ??
      "unknown",
    summary: route.summary,
  });
});
