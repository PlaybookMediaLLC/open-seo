import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";

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
      { threshold: 0.15 },
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
  color,
  className,
}: {
  children: ReactNode;
  color: string;
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
