import { cn } from "cn";

/**
 * Real screenshots of the running app, captured by `pnpm capture:product` and
 * served from src/public. Re-run that script when the UI they show changes.
 */
const PRODUCT_SHOTS = {
  opportunities: {
    src: "/product/opportunities.webp",
    alt: "The Relay Opportunities page, listing ranked page fixes with their priority, status and effort.",
  },
  rankTracking: {
    src: "/product/rank-tracking.webp",
    alt: "The Relay Rank Tracking page, showing a position distribution chart and tracked keywords with volume, difficulty and CPC.",
  },
  savedKeywords: {
    src: "/product/saved-keywords.webp",
    alt: "The Relay Saved Keywords table, with search volume, CPC, competition, difficulty and intent for each keyword.",
  },
} as const;

export type ShotKey = keyof typeof PRODUCT_SHOTS;

/**
 * The product in a macOS-style window. All screenshots are stacked so a
 * change of `shot` cross-fades instead of flashing.
 */
export function AppWindow({
  shot = "opportunities",
  className,
}: {
  shot?: ShotKey;
  className?: string;
}) {
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
          seo.playbookmedia.io
        </span>
      </div>
      <div className="relative aspect-[1.6]">
        {Object.entries(PRODUCT_SHOTS).map(([key, { src, alt }]) => (
          <img
            key={key}
            src={src}
            alt={key === shot ? alt : ""}
            width={2720}
            height={1700}
            decoding="async"
            className="absolute inset-0 size-full transition-opacity duration-500"
            style={{ opacity: key === shot ? 1 : 0 }}
          />
        ))}
      </div>
    </div>
  );
}
