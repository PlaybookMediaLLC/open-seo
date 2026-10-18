import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EmailDigestService } from "@/server/features/growth/emailDigest";
import { NotificationService } from "@/server/features/growth/NotificationService";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";

// RFC-0008 5.10: the notification bell.
export const listNotifications = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(({ context }) => NotificationService.list(context));

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(({ context }) => NotificationService.markAllRead(context));

// RFC-0008 5.11: the opt-in email digest.
export const getEmailDigest = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(({ context }) => EmailDigestService.getDigest(context));

export const setEmailDigest = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(z.object({ digest: z.enum(["off", "daily", "weekly"]) }))
  .handler(({ context, data }) =>
    EmailDigestService.setDigest(context, data.digest),
  );

export const sendTestDigest = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(({ context }) => EmailDigestService.sendTest(context));
