import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "cn";

/**
 * A one-colour brand mark from src/public/logos (simple-icons, CC0), painted
 * with the current text colour so it can be greyed out or set on a tile.
 */
export function Logo({
  slug,
  className,
  color,
}: {
  slug: string;
  className?: string;
  color?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("landing-logo", className)}
      style={{ "--logo": `url(/logos/${slug}.svg)`, color } as CSSProperties}
    />
  );
}

/** Fades and lifts its children in the first time they scroll into view. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        node.dataset.visible = "";
        observer.disconnect();
      },
      { threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("landing-reveal", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/** The small colored kicker above a section title (14/500, +0.14px). */
export function Eyebrow({
  children,
  color = "var(--l-text-3)",
  className,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[14px] font-medium leading-[21px] tracking-[0.14px]",
        className,
      )}
      style={{ color }}
    >
      {children}
    </p>
  );
}

/** Cycles through options on a timer until the user picks one. */
export function useAutoCycle(length: number, ms: number) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % length),
      ms,
    );
    return () => window.clearInterval(timer);
  }, [length, ms, paused]);
  return [
    index,
    (next: number) => {
      setPaused(true);
      setIndex(next);
    },
  ] as const;
}
