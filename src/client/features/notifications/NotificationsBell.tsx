import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconBell } from "@tabler/icons-react";
import { Button } from "@/client/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import {
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/client/components/ui/sidebar";
import {
  getEmailDigest,
  listNotifications,
  markNotificationsRead,
  sendTestDigest,
  setEmailDigest,
} from "@/serverFunctions/notifications";

const queryKey = ["growth-notifications"];

/** RFC-0008 5.10: unread count in the sidebar, newest first in a sheet. */
export function NotificationsBell() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const notifications = useQuery({
    queryKey,
    queryFn: () => listNotifications(),
    refetchInterval: 60_000,
  });
  const markRead = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
  const unread = notifications.data?.unread ?? 0;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip="Notifications"
        className="h-8 gap-2.5 rounded-lg px-2.5 text-[13px] text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground [&_svg]:size-4 [&_svg]:opacity-70"
        aria-label={
          unread ? `Notifications, ${unread} unread` : "Notifications"
        }
        onClick={() => setOpen(true)}
      >
        <IconBell />
        <span>Notifications</span>
      </SidebarMenuButton>
      {unread > 0 && <SidebarMenuBadge>{unread}</SidebarMenuBadge>}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>
              Results, deployments, traffic changes and job problems from your
              scheduled jobs.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 overflow-y-auto px-4 pb-4">
            <EmailDigestControl />
            {unread > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                pending={markRead.isPending}
                onClick={() => markRead.mutate()}
              >
                Mark all read
              </Button>
            )}
            {notifications.data?.items.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No notifications yet.
              </p>
            )}
            <ul className="space-y-2">
              {notifications.data?.items.map((item) => (
                <li key={item.id} className="rounded-lg border p-3 text-sm">
                  <a
                    href={item.linkPath}
                    className={`block hover:underline ${item.readAt ? "" : "font-semibold"}`}
                  >
                    {item.title}
                  </a>
                  <p className="mt-1 whitespace-pre-line text-muted-foreground">
                    {item.body}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </SidebarMenuItem>
  );
}

const DIGESTS = [
  { value: "off", label: "No email digest" },
  { value: "daily", label: "Email me a daily digest" },
  { value: "weekly", label: "Email me a weekly digest (Mondays)" },
] as const;

/** RFC-0008 5.11: the member's opt-in digest of unread notifications. */
function EmailDigestControl() {
  const client = useQueryClient();
  const digest = useQuery({
    queryKey: ["growth-email-digest"],
    queryFn: () => getEmailDigest(),
  });
  const save = useMutation({
    mutationFn: (value: (typeof DIGESTS)[number]["value"]) =>
      setEmailDigest({ data: { digest: value } }),
    onSettled: () =>
      client.invalidateQueries({ queryKey: ["growth-email-digest"] }),
  });
  const test = useMutation({ mutationFn: () => sendTestDigest() });
  if (!digest.data?.available) return null;
  return (
    <div className="space-y-2 rounded-lg border p-3 text-sm">
      <select
        aria-label="Email digest"
        className="h-9 w-full rounded-md border bg-background px-2"
        value={digest.data.digest}
        disabled={save.isPending}
        onChange={(event) =>
          save.mutate(
            DIGESTS.find((option) => option.value === event.target.value)
              ?.value ?? "off",
          )
        }
      >
        {DIGESTS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        pending={test.isPending}
        onClick={() => test.mutate()}
      >
        Email me a test digest
      </Button>
      {test.data && <p role="status">{test.data.message}</p>}
    </div>
  );
}
