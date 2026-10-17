import { createServerFn } from "@tanstack/react-start";
import { NotificationService } from "@/server/features/growth/NotificationService";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";

// RFC-0008 5.10: the notification bell.
export const listNotifications = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(({ context }) => NotificationService.list(context));

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(({ context }) => NotificationService.markAllRead(context));
