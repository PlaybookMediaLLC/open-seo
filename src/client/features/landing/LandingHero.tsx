import { Link } from "@tanstack/react-router";
import { useEffect, useState, type PointerEvent } from "react";
import {
  IconArrowRight,
  IconBrandGoogle,
  IconChevronRight,
  IconSparkles,
} from "@tabler/icons-react";
import { BrandMark } from "@/client/components/BrandMark";

export function LandingNav({ signedIn }: { signedIn: boolean }) {
  return (
    <nav className="landing-nav" aria-label="Primary">
      <a href="#top" className="landing-nav-link" data-active="">
        Home
      </a>
      <a href="#features" className="landing-nav-link hidden sm:inline">
        Features
      </a>
      <a href="#agents" className="landing-nav-link hidden sm:inline">
        Agents
      </a>
      <a href="#pricing" className="landing-nav-link">
        Pricing
      </a>
      <Link to={signedIn ? "/app" : "/sign-in"} className="landing-nav-cta">
        <BrandMark className="size-[15px]" />
        {signedIn ? "Open app" : "Get started"}
      </Link>
    </nav>
  );
}

// The spotlight follows the pointer through CSS variables, no re-render.
function trackPointer(event: PointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const { style } = event.currentTarget;
  style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
  style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
}

const TAGLINES = [
  ["Turn search data into", "shipped improvements."],
  ["Find what to fix,", "then prove it worked."],
  ["Your AI agent’s", "SEO co-pilot."],
] as const;

export function LandingHero({ signedIn }: { signedIn: boolean }) {
  const start = signedIn ? "/app" : "/sign-in";
  return (
    <section
      id="top"
      onPointerMove={trackPointer}
      className="landing-sky-dusk relative flex h-[100dvh] min-h-[640px] w-full items-center justify-center overflow-hidden"
    >
      <HeroBackdrop />
      <div className="relative z-10 w-[672px] max-w-full px-4 text-center text-white/80">
        <h1 className="m-0 mb-6 text-[36px] font-semibold leading-[38.5px] tracking-[-1.8px] text-[#fafafa] sm:text-[48px] sm:leading-[51px] sm:tracking-[-1.92px]">
          <span className="block">Just ship.</span>
          <span className="block">Rank faster.</span>
        </h1>
        <div className="my-3 flex flex-col items-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to={start} className="landing-cta-light">
              <IconBrandGoogle className="size-[18px]" />
              {signedIn ? "Open OpenSEO" : "Continue with Google"}
            </Link>
            <a href="#features" className="landing-cta-dark">
              <IconSparkles className="size-[18px]" />
              See how it works
            </a>
          </div>
          <a
            href="#pricing"
            className="mt-3 flex items-center gap-1 text-[13px] text-white/50 transition-colors hover:text-white/70"
          >
            Free plan included, no card required
            <IconChevronRight className="size-3.5" />
          </a>
        </div>
        <TypedTagline />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-black" />
    </section>
  );
}

/** Types each tagline out, holds, then moves to the next. */
function TypedTagline() {
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [first, second] = TAGLINES[index] ?? TAGLINES[0];
  const full = `${first}\n${second}`;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(full.length);
      return;
    }
    const done = count >= full.length;
    const timer = window.setTimeout(
      () => {
        if (!done) setCount(count + 1);
        else {
          setCount(0);
          setIndex((index + 1) % TAGLINES.length);
        }
      },
      done ? 2600 : 38,
    );
    return () => window.clearTimeout(timer);
  }, [count, full.length, index]);

  const shown = full.slice(0, count);
  const [line1, line2 = ""] = shown.split("\n");
  return (
    <div
      className="mt-6 text-[16px] leading-[22.4px] tracking-[0.16px]"
      aria-label={`${first} ${second}`}
    >
      <div className="text-white" aria-hidden>
        {line1}
        {count <= first.length ? <Caret /> : null}
      </div>
      <div className="min-h-[22px] text-white/60" aria-hidden>
        {line2}
        {count > first.length ? <Caret /> : null}
      </div>
    </div>
  );
}

function Caret() {
  return (
    <span className="landing-caret ml-px inline-block h-[17px] w-[1.5px] translate-y-[3px] bg-white/80" />
  );
}

/** Layered night sky: superwhisper's dusk gradient cross-fading to night,
 *  drifting aurora, twinkling and shooting stars, rim-lit silhouettes and a
 *  pointer spotlight. */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="landing-sky-night absolute inset-0" />
      <div className="landing-aurora">
        <span className="landing-aurora-a" />
        <span className="landing-aurora-b" />
        <span className="landing-aurora-c" />
      </div>
      <div className="landing-stars absolute inset-0" />
      <div className="landing-stars landing-stars-alt absolute inset-0" />
      {SHOOTING.map(([left, top, delay, duration]) => (
        <span
          key={`${left}-${top}`}
          className="landing-shooting"
          style={{
            left,
            top,
            animationDelay: delay,
            animationDuration: duration,
          }}
        />
      ))}
      <Silhouette side="left" />
      <Silhouette side="right" />
      <div className="landing-spotlight" />
    </div>
  );
}

const SHOOTING = [
  ["78%", "6%", "0.4s", "7s"],
  ["52%", "2%", "2.1s", "9s"],
  ["92%", "22%", "3.6s", "7s"],
  ["34%", "10%", "5.2s", "8s"],
] as const;

/** A dark profile with a violet rim light, cropped at the viewport edge. */
function Silhouette({ side }: { side: "left" | "right" }) {
  const left = side === "left";
  return (
    <svg
      viewBox="0 0 260 500"
      className="landing-silhouette hidden h-[78vh] max-h-[720px] md:block"
      style={{
        [left ? "left" : "right"]: left ? "-2vw" : "-4vw",
        top: left ? 0 : "25vh",
        opacity: left ? 1 : 0.9,
        transform: left ? undefined : "scaleX(-1)",
        animationDelay: left ? "0s" : "-6s",
      }}
    >
      <defs>
        <linearGradient id={`rim-${side}`} x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0.7" stopColor="#04020a" />
          <stop offset="0.95" stopColor="#2a1f63" />
          <stop offset="1" stopColor="#9a86ff" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#rim-${side})`}
        d="M0 0h168c4 26 12 46 30 66 16 17 30 26 44 36 8 6 8 12 1 16-6 3-12 6-16 10 4 6 4 12 0 17 5 7 3 13-3 17 6 10 4 21-6 28-12 8-27 11-41 13-6 16-9 34-10 50-1 16-6 26-20 32-30 12-66 16-104 20C26 340 10 356 0 384Z"
      />
    </svg>
  );
}

export function LandingSeeAll() {
  return (
    <a
      href="#pricing"
      className="inline-flex items-center gap-1 text-[14px] font-medium tracking-[0.14px] text-[#888b91] underline decoration-white/25 underline-offset-4 transition-colors hover:text-white"
    >
      Compare plans <IconArrowRight className="size-3.5" />
    </a>
  );
}
