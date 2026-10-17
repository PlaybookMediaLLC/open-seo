import { createAuthMiddleware } from "better-auth/api";
import { recordAudit, type AuditAction } from "./auditLog";

// RFC-0009 5.6: member removal and API key changes run in better-auth's
// own endpoints. This after hook records them once they succeed.
const ROUTES: Record<string, { action: AuditAction; summary: string }> = {
  "/organization/remove-member": {
    action: "member.removed",
    summary: "Removed a member",
  },
  "/api-key/create": {
    action: "api_key.created",
    summary: "Created an API key",
  },
  "/api-key/delete": {
    action: "api_key.deleted",
    summary: "Deleted an API key",
  },
};

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null
    ? Reflect.get(value, key)
    : undefined;
const text = (value: unknown) =>
  typeof value === "string" && value ? value : null;

export const auditAuthRoute = createAuthMiddleware(async (ctx) => {
  const route = ROUTES[ctx.path];
  const returned: unknown = ctx.context.returned;
  const session = ctx.context.session;
  if (!route || !session || returned instanceof Error) return;
  const body: unknown = ctx.body;
  const organizationId =
    text(field(body, "organizationId")) ??
    text(field(session.session, "activeOrganizationId"));
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
