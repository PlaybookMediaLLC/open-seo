import { useLayoutEffect } from "react";
import zoomCss from "./appZoom.css?raw";

/**
 * Scope native-scale tokens to app layouts. The authenticated and agent
 * layouts set it while mounted (at `// playbook-seam` lines), so the landing
 * page keeps its own design tokens.
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
