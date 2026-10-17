import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { growthNotificationReads, growthNotifications } from "@/db/schema";

// RFC-0008 5.10: the organization's in-app notifications, newest first, with
// each member's own read state.
const LIST_LIMIT = 50;
type Viewer = { organizationId: string; userId: string };

async function list(viewer: Viewer) {
  const rows = await db
    .select({
      id: growthNotifications.id,
      projectId: growthNotifications.projectId,
      kind: growthNotifications.kind,
      title: growthNotifications.title,
      body: growthNotifications.body,
      linkPath: growthNotifications.linkPath,
      createdAt: growthNotifications.createdAt,
      readAt: growthNotificationReads.readAt,
    })
    .from(growthNotifications)
    .leftJoin(
      growthNotificationReads,
      and(
        eq(growthNotificationReads.notificationId, growthNotifications.id),
        eq(growthNotificationReads.userId, viewer.userId),
      ),
    )
    .where(eq(growthNotifications.organizationId, viewer.organizationId))
    .orderBy(desc(growthNotifications.createdAt), desc(growthNotifications.id))
    .limit(LIST_LIMIT);
  return {
    items: rows,
    unread: rows.filter((row) => !row.readAt).length,
  };
}

async function markAllRead(viewer: Viewer) {
  const unread = (await list(viewer)).items.filter((row) => !row.readAt);
  if (!unread.length) return;
  const readAt = new Date().toISOString();
  await runBatch((tx) =>
    unread.map((row) =>
      tx
        .insert(growthNotificationReads)
        .values({
          id: crypto.randomUUID(),
          projectId: row.projectId,
          notificationId: row.id,
          userId: viewer.userId,
          readAt,
        })
        .onConflictDoNothing(),
    ),
  );
}

export const NotificationService = { list, markAllRead };
