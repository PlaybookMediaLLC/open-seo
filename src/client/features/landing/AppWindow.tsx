import { useEffect, useRef } from "react";
import { cn } from "cn";

/**
 * The product in a macOS-style window, playing a recorded walkthrough of the
 * real, signed-in app. `pnpm capture:product` records it into src/public;
 * re-record when the UI it shows changes.
 */
export function AppWindow({ className }: { className?: string }) {
  const video = useRef<HTMLVideoElement>(null);

  // The video (1.4 MB) waits for the first scroll, so it never competes
  // with the first paint; the poster shows until then. Only a visible copy
  // loads: the hero's desktop frame is hidden on phones. React renders
  // `muted` as a property, so set it before playing. Motion-sensitive
  // visitors keep the still poster.
  useEffect(() => {
    const node = video.current;
    const scroller = document.querySelector(".landing-scroll");
    if (!node || !scroller) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = () => {
      if (node.offsetParent === null) return;
      scroller.removeEventListener("scroll", start);
      node.muted = true;
      node.preload = "auto";
      node.play().catch(() => {});
    };
    scroller.addEventListener("scroll", start, { passive: true });
    return () => scroller.removeEventListener("scroll", start);
  }, []);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[11px] border border-white/10 bg-[#0a0a0b] shadow-[0_0_0_0.5px_rgb(0_0_0/0.6),0_30px_80px_-20px_rgb(0_0_0/0.7)]",
        className,
      )}
    >
      <div className="flex items-center gap-[7px] border-b border-white/[0.06] bg-[#141416] px-[10px] py-[9px]">
        <span className="size-[11px] rounded-full bg-[#ff5f57]" />
        <span className="size-[11px] rounded-full bg-[#febc2e]" />
        <span className="size-[11px] rounded-full bg-[#28c840]" />
        <span className="mx-auto -translate-x-[27px] rounded-md bg-white/[0.06] px-3 py-0.5 text-[10px] text-white/40">
          relay.playbookmedia.io
        </span>
      </div>
      <video
        ref={video}
        className="block aspect-[1.6] w-full bg-black"
        poster="/media/app-demo.webp"
        muted
        loop
        playsInline
        preload="none"
        aria-label="A walkthrough of Relay: ranked opportunities, rank tracking for a domain, and saved keywords."
      >
        <source src="/media/app-demo.webm" type="video/webm; codecs=vp9" />
        <source src="/media/app-demo.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
