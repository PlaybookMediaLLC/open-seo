import { useState, type ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import { AppBanner } from "@/client/layout/AppBanner";

/* Playbook fork: an info banner the user can close. It stays closed in this
   browser for 30 days, then returns. Warnings never use it. */

const DAY_MS = 24 * 60 * 60 * 1000;

function isDismissed(storageKey: string) {
  try {
    const at = Number(localStorage.getItem(storageKey));
    return at > 0 && Date.now() - at < 30 * DAY_MS;
  } catch {
    return false;
  }
}

export function DismissibleBanner({
  storageKey,
  children,
}: {
  storageKey: string;
  children: ReactNode;
}) {
  const [hidden, setHidden] = useState(() => isDismissed(storageKey));
  if (hidden) return null;
  return (
    <AppBanner variant="info">
      <span className="flex items-center gap-3">
        <span className="min-w-0 flex-1">{children}</span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            try {
              localStorage.setItem(storageKey, String(Date.now()));
            } catch {
              // Without storage the banner still closes for this visit.
            }
            setHidden(true);
          }}
          className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <IconX className="size-4" />
        </button>
      </span>
    </AppBanner>
  );
}
