import { useLayoutEffect } from "react";
import zoomCss from "./appZoom.css?raw";

/**
 * Playbook fork: renders the signed-in app at 80% on desktop. The authenticated
 * layouts set it while mounted (at `// playbook-seam` lines), so the landing
 * page and docs stay at 100%. On <html>, so menus, tooltips and dialogs that
 * render in portals scale with the page.
 */
export function useAppZoom() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const style = document.createElement("style");
    style.textContent = zoomCss;
    document.head.appendChild(style);
    root.setAttribute("data-app-zoom", "");
    return () => {
      root.removeAttribute("data-app-zoom");
      style.remove();
    };
  }, []);
}
