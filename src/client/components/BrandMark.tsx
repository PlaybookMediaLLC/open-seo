import { cn } from "cn";

/** The Relay mark: a white R on a black square. Same art as the favicon. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="100 100 440 440"
      aria-hidden
      className={cn("shrink-0", className)}
      fill="none"
    >
      <rect x="100" y="100" width="440" height="440" fill="#0a0a0a" />
      <g transform="translate(-12 0)" stroke="#fff" strokeWidth="72">
        <path d="M226 150V490" />
        <path d="M190 186H340A74 74 0 0 1 340 334H262" />
        <polygon
          points="300,394 378,394 474,490 396,490"
          fill="#fff"
          stroke="none"
        />
      </g>
    </svg>
  );
}
