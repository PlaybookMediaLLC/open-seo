import { env } from "cloudflare:workers";
import { and, desc, eq, gt, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  growthEmailPreferences,
  growthNotificationReads,
  growthNotifications,
  member,
  organization,
  user,
} from "@/db/schema";
import { AppError } from "@/server/lib/errors";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

// RFC-0008 5.11: an opt-in email digest of each member's unread
// notifications. It sends through the Cloudflare Email binding that team
// invitations use; without the binding nothing is sent.
const FROM = { name: "Relay", email: "notifications@mail.playbookmedia.io" };
const MAX_ITEMS = 20;
const DAY_MS = 86_400_000;
type Viewer = { organizationId: string; userId: string };
type Digest = "off" | "daily" | "weekly";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

async function preference(viewer: Viewer) {
  const [row] = await db
    .select()
    .from(growthEmailPreferences)
    .where(
      and(
        eq(growthEmailPreferences.userId, viewer.userId),
        eq(growthEmailPreferences.organizationId, viewer.organizationId),
      ),
    );
  return row ?? null;
}

async function getDigest(viewer: Viewer) {
  return {
    digest: (await preference(viewer))?.digest ?? "off",
    available: Boolean(env.EMAIL),
  };
}

async function setDigest(viewer: Viewer, digest: Digest) {
  const now = new Date().toISOString();
  await db
    .insert(growthEmailPreferences)
    .values({
      id: crypto.randomUUID(),
      userId: viewer.userId,
      organizationId: viewer.organizationId,
      digest,
      // A new digest starts from now, not from old notifications.
      lastSentAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        growthEmailPreferences.userId,
        growthEmailPreferences.organizationId,
      ],
      set: { digest, updatedAt: now },
    });
}

/** The member's unread notifications, newest first, after `since`. */
function unread(viewer: Viewer, since: string | null) {
  return db
    .select({
      title: growthNotifications.title,
      body: growthNotifications.body,
      linkPath: growthNotifications.linkPath,
      createdAt: growthNotifications.createdAt,
    })
    .from(growthNotifications)
    .leftJoin(
      growthNotificationReads,
      and(
        eq(growthNotificationReads.notificationId, growthNotifications.id),
        eq(growthNotificationReads.userId, viewer.userId),
      ),
    )
    .where(
      and(
        eq(growthNotifications.organizationId, viewer.organizationId),
        isNull(growthNotificationReads.id),
        since ? gt(growthNotifications.createdAt, since) : undefined,
      ),
    )
    .orderBy(desc(growthNotifications.createdAt))
    .limit(MAX_ITEMS);
}

async function send(
  to: string,
  organizationName: string,
  items: Awaited<ReturnType<typeof unread>>,
) {
  const sender = env.EMAIL;
  if (!sender) return false;
  const origin =
    (await getOptionalEnvValue("BETTER_AUTH_URL")) ??
    "https://relay.playbookmedia.io";
  const subject = `Relay: ${items.length} new notification${items.length === 1 ? "" : "s"} for ${organizationName}`;
  await sender.send({
    from: FROM,
    to,
    subject: subject.replace(/\s+/g, " "),
    text: `${items
      .map((item) => `${item.title}\n${item.body}\n${origin}${item.linkPath}`)
      .join(
        "\n\n",
      )}\n\nChange or turn off this digest in Relay > Notifications.`,
    html: `${items
      .map(
        (item) =>
          `<p><a href="${escapeHtml(`${origin}${item.linkPath}`)}"><strong>${escapeHtml(item.title)}</strong></a><br>${escapeHtml(item.body)}</p>`,
      )
      .join(
        "",
      )}<p style="color:#666">Change or turn off this digest in Relay &gt; Notifications.</p>`,
  });
  return true;
}

/**
 * The daily digest run, from the Worker cron at 08:00 UTC. Weekly digests go
 * out on Mondays. A member who left the organization gets nothing.
 */
export async function sendDigests(now: Date) {
  if (!env.EMAIL) return { sent: 0 };
  const rows = await db
    .select({
      preference: growthEmailPreferences,
      email: user.email,
      organizationName: organization.name,
    })
    .from(growthEmailPreferences)
    .innerJoin(user, eq(user.id, growthEmailPreferences.userId))
    .innerJoin(
      organization,
      eq(organization.id, growthEmailPreferences.organizationId),
    )
    .innerJoin(
      member,
      and(
        eq(member.userId, growthEmailPreferences.userId),
        eq(member.organizationId, growthEmailPreferences.organizationId),
      ),
    )
    .where(ne(growthEmailPreferences.digest, "off"));
  let sent = 0;
  for (const { preference: row, email, organizationName } of rows) {
    if (row.digest === "weekly" && now.getUTCDay() !== 1) continue;
    // A retried tick never sends twice in a day.
    if (
      row.lastSentAt &&
      now.getTime() - Date.parse(row.lastSentAt) < DAY_MS / 2
    )
      continue;
    const items = await unread(row, row.lastSentAt);
    if (!items.length) continue;
    if (await send(email, organizationName, items)) sent++;
    await db
      .update(growthEmailPreferences)
      .set({ lastSentAt: now.toISOString() })
      .where(eq(growthEmailPreferences.id, row.id));
  }
  return { sent };
}

/** Sends the member their latest unread notifications now, to check delivery. */
async function sendTest(viewer: Viewer) {
  const [row] = await db
    .select({ email: user.email, organizationName: organization.name })
    .from(user)
    .innerJoin(organization, eq(organization.id, viewer.organizationId))
    .where(eq(user.id, viewer.userId));
  if (!row) throw new AppError("NOT_FOUND");
  const items = await unread(viewer, null);
  if (!items.length)
    return {
      sent: false,
      message: "You have no unread notifications to send.",
    };
  return (await send(row.email, row.organizationName, items))
    ? { sent: true, message: `Sent to ${row.email}.` }
    : { sent: false, message: "Email is not set up on this install." };
}

export const EmailDigestService = { getDigest, setDigest, sendTest };
