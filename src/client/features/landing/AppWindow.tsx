import { useEffect, useRef } from "react";
import { cn } from "cn";

/**
 * The product in a macOS-style window, playing a recorded walkthrough of the
 * real, signed-in app. `pnpm capture:product` records it into src/public;
 * re-record when the UI it shows changes.
 */
export function AppWindow({ className }: { className?: string }) {
  const video = useRef<HTMLVideoElement>(null);

  // React renders `muted` as a property, not into the server HTML, so the
  // browser blocks the autoplay; start it once mounted. Motion-sensitive
  // visitors get the still poster instead.
  useEffect(() => {
    const node = video.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.pause();
      return;
    }
    node.muted = true;
    node.play().catch(() => {});
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
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="A walkthrough of Relay: ranked opportunities, rank tracking for a domain, and saved keywords."
      >
        <source src="/media/app-demo.webm" type="video/webm; codecs=vp9" />
        <source src="/media/app-demo.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
