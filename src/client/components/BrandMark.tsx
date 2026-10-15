import { cn } from "cn";

/** The OpenSEO mark: a rising signal inside a rounded tile. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn("shrink-0", className)}
      fill="none"
    >
      <defs>
        <linearGradient id="brandmark-fill" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0" stopColor="#6d8dff" />
          <stop offset="0.55" stopColor="#8a6cff" />
          <stop offset="1" stopColor="#d77ab8" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="7" fill="url(#brandmark-fill)" />
      <path
        d="M6.5 15.5 10 12l2.5 2.5L17.5 9"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17.5" cy="9" r="1.4" fill="#fff" />
    </svg>
  );
}
