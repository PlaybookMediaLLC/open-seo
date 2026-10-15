import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import {
  IconBrandGoogle,
  IconChevronRight,
  IconSparkles,
} from "@tabler/icons-react";
import { BrandMark } from "@/client/components/BrandMark";
import { AppWindow } from "./AppWindow";

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

/**
 * The hero, built like superwhisper's: a tall scroll stage with a sticky
 * viewport. The intro holds, then fades as the product window rises out of
 * the sky and settles. One rAF-throttled scroll handler drives both.
 */
export function LandingHero({ signedIn }: { signedIn: boolean }) {
  const stage = useRef<HTMLDivElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = document.querySelector(".landing-scroll");
    const node = stage.current;
    if (!scroller || !node) return;
    let queued = false;

    const apply = () => {
      queued = false;
      const total = node.offsetHeight - window.innerHeight;
      const progress = total > 0 ? Math.min(1, scroller.scrollTop / total) : 0;
      // The intro holds, then clears out before the window arrives.
      const fade = clamp((progress - 0.12) / 0.16);
      if (intro.current) {
        intro.current.style.opacity = String(1 - fade);
        intro.current.style.transform = `translateY(${-fade * 48}px)`;
      }
      // The window rises from below and settles into place.
      const rise = clamp((progress - 0.26) / 0.44);
      if (frame.current) {
        const eased = 1 - Math.pow(1 - rise, 3);
        frame.current.style.opacity = String(Math.min(1, rise * 2));
        frame.current.style.transform = `translateY(${(1 - eased) * 46}vh) scale(${0.82 + eased * 0.18})`;
      }
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(apply);
    };

    apply();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section id="top" ref={stage} className="relative h-[260vh] w-full">
      <div className="landing-sky-dusk sticky top-0 h-[100dvh] overflow-hidden">
        <HeroBackdrop />
        <div
          ref={intro}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center px-4 text-center"
        >
          <div className="w-[672px] max-w-full">
            <h1 className="m-0 mb-6 text-[36px] font-semibold leading-[38.5px] tracking-[-1.8px] text-[#fafafa] sm:text-[48px] sm:leading-[51px] sm:tracking-[-1.92px]">
              <span className="block">Just ship.</span>
              <span className="block">Rank faster.</span>
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to={signedIn ? "/app" : "/sign-in"}
                className="landing-cta-light"
              >
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
              className="mt-3 inline-flex items-center gap-1 text-[13px] text-white/50 transition-colors hover:text-white/70"
            >
              Free plan included, no card required
              <IconChevronRight className="size-3.5" />
            </a>
            <p className="mt-6 text-[16px] leading-[22.4px] tracking-[0.16px] text-white">
              Turn search data into shipped improvements.
              <span className="block text-white/60">
                Works with Search Console, your repo and your AI agent.
              </span>
            </p>
          </div>
        </div>

        {/* The product, rising out of the sky as the page scrolls. */}
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
          <div
            ref={frame}
            className="w-full max-w-[1100px] origin-bottom opacity-0 will-change-transform"
          >
            <AppWindow priority />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-black" />
      </div>
    </section>
  );
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

/** Drifting aurora, twinkling stars and shooting stars over the sky. */
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
    </div>
  );
}

const SHOOTING = [
  ["78%", "6%", "0.4s", "7s"],
  ["52%", "2%", "2.1s", "9s"],
  ["92%", "22%", "3.6s", "7s"],
  ["34%", "10%", "5.2s", "8s"],
] as const;
