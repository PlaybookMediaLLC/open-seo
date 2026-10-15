import { cn } from "cn";

/**
 * Real screenshots of the running app, captured by `pnpm capture:product` and
 * served from src/public. Re-run that script when the UI they show changes.
 */
const PRODUCT_SHOTS = {
  opportunities: {
    src: "/product/opportunities.webp",
    alt: "The OpenSEO Opportunities page, listing ranked page fixes with their priority, status and effort.",
  },
  rankTracking: {
    src: "/product/rank-tracking.webp",
    alt: "The OpenSEO Rank Tracking page, showing a position distribution chart and tracked keywords with volume, difficulty and CPC.",
  },
  savedKeywords: {
    src: "/product/saved-keywords.webp",
    alt: "The OpenSEO Saved Keywords table, with search volume, CPC, competition, difficulty and intent for each keyword.",
  },
} as const;

type ShotKey = keyof typeof PRODUCT_SHOTS;

/**
 * A product screenshot in a macOS-style window. `zoom` crops into the image so
 * a card can feature one region of the UI instead of the whole page.
 */
export function AppWindow({
  shot = "opportunities",
  className,
  zoom,
  priority = false,
}: {
  shot?: ShotKey;
  className?: string;
  /** Scale and offset, as a fraction of the image, to crop into one region. */
  zoom?: { scale: number; x: string; y: string };
  priority?: boolean;
}) {
  const { src, alt } = PRODUCT_SHOTS[shot];
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0b] shadow-[0_60px_140px_-40px_rgb(0_0_0/0.9)] sm:rounded-2xl",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-[#121214] px-3 py-2.5">
        <span className="size-[9px] rounded-full bg-[#ff5f57]" />
        <span className="size-[9px] rounded-full bg-[#febc2e]" />
        <span className="size-[9px] rounded-full bg-[#28c840]" />
        <span className="mx-auto rounded-md bg-white/[0.06] px-3 py-0.5 text-[10px] text-white/40">
          seo.playbookmedia.io
        </span>
      </div>
      <div className="overflow-hidden">
        <img
          src={src}
          alt={alt}
          width={2720}
          height={1700}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="block w-full"
          style={
            zoom
              ? {
                  transform: `scale(${zoom.scale})`,
                  transformOrigin: `${zoom.x} ${zoom.y}`,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}

/**
 * A cropped region of a screenshot, framed as a floating panel. Used as the
 * art at the top of a feature card.
 */
export function ShotCrop({
  shot,
  width,
  aspect,
  focus,
  scale = 2,
}: {
  shot: ShotKey;
  /** Rendered width in pixels. */
  width: number;
  /** Rendered height as a fraction of the width. */
  aspect: number;
  /** Which part of the screenshot to show, as CSS background-position. */
  focus: string;
  scale?: number;
}) {
  const { src, alt } = PRODUCT_SHOTS[shot];
  return (
    <div
      className="overflow-hidden rounded-xl border border-white/10 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8)]"
      style={{ width, height: width * aspect }}
      role="img"
      aria-label={alt}
    >
      <div
        className="size-full bg-no-repeat"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: `${scale * 100}%`,
          backgroundPosition: focus,
        }}
      />
    </div>
  );
}
