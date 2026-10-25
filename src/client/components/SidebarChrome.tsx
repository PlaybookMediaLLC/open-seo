import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { IconLayoutSidebar as PanelLeft } from "@tabler/icons-react";
import { BrandMark } from "@/client/components/BrandMark";
import { SidebarTrigger, useSidebar } from "@/client/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/client/components/ui/tooltip";

/* Playbook fork: the sidebar's expanded and collapsed chrome. Collapsed, the
   sidebar is an icon rail: the mark expands it, ⌘B toggles it, and each row
   shows its label as a tooltip. */

/** Desktop with the sidebar collapsed to its icon rail. */
export function useRail() {
  const { state, isMobile } = useSidebar();
  return state === "collapsed" && !isMobile;
}

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iP(hone|ad)/.test(navigator.platform);

/** The shortcut hint shown in the collapse and expand tooltips. */
function ShortcutHint() {
  return (
    <span className="ml-2 rounded border border-current/25 px-1 font-mono text-[10px] opacity-70">
      {isMac ? "⌘B" : "Ctrl B"}
    </span>
  );
}

/** ⌘B / Ctrl+B toggles the rail on desktop. The primitive only binds it on
 *  phones; here it skips text fields, where the keys mean bold. */
export function useDesktopShortcut() {
  const { isMobile, toggleSidebar } = useSidebar();
  useEffect(() => {
    if (isMobile) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "b" || !(event.metaKey || event.ctrlKey)) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input, textarea, select"))
      )
        return;
      event.preventDefault();
      toggleSidebar();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobile, toggleSidebar]);
}

/** The wordmark and the collapse button. In the rail, the mark itself
 *  expands the sidebar and shows the sidebar icon on hover. */
export function SidebarBrand() {
  const { setOpenMobile, toggleSidebar } = useSidebar();
  const rail = useRail();
  if (rail) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Expand sidebar"
              className="group/brand relative grid size-8 place-items-center rounded-lg text-sidebar-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            />
          }
        >
          <BrandMark className="size-5 transition-opacity group-hover/brand:opacity-0" />
          <PanelLeft className="absolute size-4 opacity-0 transition-opacity group-hover/brand:opacity-100" />
        </TooltipTrigger>
        <TooltipContent side="right">
          Expand sidebar
          <ShortcutHint />
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <div className="flex h-8 items-center justify-between pl-2.5">
      <Link
        to="/app"
        onClick={() => setOpenMobile(false)}
        className="flex items-center gap-2 rounded-md text-[15px] font-semibold tracking-tight text-sidebar-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <BrandMark className="size-5" />
        OpenSEO
      </Link>
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarTrigger
              aria-label="Collapse sidebar"
              className="hidden size-7 text-sidebar-foreground hover:text-sidebar-foreground md:inline-flex"
            />
          }
        />
        <TooltipContent side="right">
          Collapse sidebar
          <ShortcutHint />
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
