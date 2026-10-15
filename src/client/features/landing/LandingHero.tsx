import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  IconBattery3,
  IconBrandGoogle,
  IconChevronRight,
  IconWifi,
} from "@tabler/icons-react";
import { BrandMark } from "@/client/components/BrandMark";
import { AppWindow } from "./AppWindow";
import { Logo } from "./LandingPrimitives";
import { LandingTetris } from "./LandingTetris";

/** The floating pill nav. Like superwhisper's, it stays out of the way until
 *  the visitor scrolls past the hero's own call to action. `pinned` keeps it
 *  visible, for pages without that hero. */
export function LandingNav({
  signedIn,
  pinned = false,
}: {
  signedIn: boolean;
  pinned?: boolean;
}) {
  const [atTop, setAtTop] = useState(!pinned);

  useEffect(() => {
    const scroller = document.querySelector(".landing-scroll");
    if (pinned || !scroller) return;
    const onScroll = () => setAtTop(scroller.scrollTop < 40);
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [pinned]);

  return (
    <nav
      className="landing-nav"
      aria-label="Primary"
      data-hidden={atTop ? "" : undefined}
    >
      <a href="/#top" className="landing-nav-brand">
        <BrandMark className="size-4" />
        Relay
      </a>
      <a href="/#features" className="landing-nav-link hidden sm:inline">
        Features
      </a>
      <a href="/docs" className="landing-nav-link hidden sm:inline">
        Docs
      </a>
      <a href="/#pricing" className="landing-nav-link">
        Pricing
      </a>
      <Link to={signedIn ? "/app" : "/sign-in"} className="landing-nav-cta">
        {signedIn ? "Open app" : "Get started"}
      </Link>
    </nav>
  );
}

/**
 * The hero, built like superwhisper's: a pinned full-bleed field that shrinks
 * into a 1024 x 627 rounded frame as the page scrolls. The intro fades out,
 * and the frame becomes a small desktop playing a walkthrough of the app. One
 * rAF-throttled scroll handler drives it all. Phones get a static hero.
 */
export function LandingHero({ signedIn }: { signedIn: boolean }) {
  const frame = useRef<HTMLDivElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const desk = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = document.querySelector(".landing-scroll");
    if (!scroller) return;
    const wide = window.matchMedia("(min-width: 800px)");
    let queued = false;

    const apply = () => {
      queued = false;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scroll = wide.matches ? scroller.scrollTop : 0;
      const shrinkEnd = vh * 0.8;
      const p = smooth(clamp(scroll / shrinkEnd));
      // The frame's final insets: 1024 x 627, but never under the nav.
      const x = Math.max(24, (vw - 1024) / 2);
      const y = Math.max(80, (vh - 627) / 2);
      if (frame.current) {
        frame.current.style.clipPath = `inset(${p * y}px ${p * x}px round ${p * 18}px)`;
      }
      if (intro.current) {
        const fade = clamp(p * 1.6);
        intro.current.style.opacity = String(1 - fade);
        intro.current.style.transform = `translateY(${-86 * p}px) scale(${1 + 0.15 * p})`;
        intro.current.style.visibility = fade >= 1 ? "hidden" : "visible";
      }
      if (desk.current) {
        const show = clamp((p - 0.55) / 0.45);
        desk.current.style.inset = `${y}px ${x}px`;
        desk.current.style.opacity = String(show);
        desk.current.style.transform = `translateY(${(1 - show) * 24}px)`;
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
    <>
      <section id="top" className="landing-hero relative w-full">
        <div className="sticky top-0 h-[100svh] overflow-hidden bg-black">
          <div ref={frame} className="landing-frame">
            <LandingTetris className="absolute left-0 top-0" />
            <div
              ref={intro}
              className="absolute inset-0 z-20 flex items-center justify-center px-4 text-center"
            >
              {/* Keeps the headline legible over the falling pieces. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_46%_42%_at_50%_52%,#000_45%,transparent_100%)]"
              />
              <div className="relative w-[672px] max-w-full">
                <p className="mb-5 inline-flex items-center gap-2 text-[15px] font-medium tracking-[-0.2px] text-white/80">
                  <BrandMark className="size-5" />
                  Relay
                  <span className="text-white/45">
                    · SEO for you and your AI agent
                  </span>
                </p>
                <h1 className="m-0 mb-6 text-[36px] font-semibold leading-[38.5px] tracking-[-1.8px] text-(--l-text) sm:text-[48px] sm:leading-[51px] sm:tracking-[-1.92px]">
                  <span className="block">Rank higher on Google.</span>
                  <span className="block">Your agent ships the fixes.</span>
                </h1>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link
                    to={signedIn ? "/app" : "/sign-in"}
                    className="landing-cta-light"
                  >
                    <IconBrandGoogle className="size-[18px]" />
                    {signedIn ? "Open Relay" : "Continue with Google"}
                  </Link>
                </div>
                <a
                  href="#pricing"
                  className="mt-3 inline-flex items-center gap-1 text-[13px] text-white/50 transition-colors hover:text-white/70"
                >
                  Free plan included, no card required
                  <IconChevronRight className="size-3.5" />
                </a>
                <p className="mt-12 text-[16px] leading-[22.4px] tracking-[0.16px]">
                  <Typewriter text="SEO fixes from your Search Console, ranked by clicks." />
                  <span className="block text-white/60">
                    Works with Claude Code, Codex, Cursor and ChatGPT.
                  </span>
                </p>
              </div>
            </div>

            <div
              ref={desk}
              aria-hidden
              className="landing-desk pointer-events-none absolute hidden opacity-0 min-[800px]:block"
            >
              <MenuBar />
              <div className="absolute inset-0 flex items-center justify-center pb-16 pt-[34px]">
                <AppWindow className="landing-desk-window" />
              </div>
              <Dock />
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-black min-[800px]:hidden" />
        </div>
      </section>

      {/* Phones skip the pinned frame, so show the product right after. */}
      <div className="w-full px-4 pb-8 min-[800px]:hidden">
        <AppWindow />
      </div>
    </>
  );
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

/** Smoothstep easing, so the frame settles instead of stopping hard. */
function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

/** Types its text out once, like superwhisper's dictation line. */
function Typewriter({ text }: { text: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(text.length);
      return;
    }
    if (count >= text.length) return;
    const timer = window.setTimeout(
      () => setCount((current) => current + 1),
      count === 0 ? 900 : 42,
    );
    return () => window.clearTimeout(timer);
  }, [count, text.length]);

  return (
    <span className="block text-white">
      <span className="sr-only">{text}</span>
      {/* The untyped rest stays in the layout, invisible, so the line keeps
          its final size and the centered hero never shifts as it types. */}
      <span aria-hidden>
        {text.slice(0, count)}
        <span className="landing-caret ml-px inline-block h-[17px] w-[1.5px] translate-y-[3px] bg-white/80" />
        <span className="invisible">{text.slice(count)}</span>
      </span>
    </span>
  );
}

const MENUS = ["File", "Edit", "View", "Window", "Help"];

/** The framed desktop's macOS menu bar. */
function MenuBar() {
  return (
    <div className="landing-menubar absolute inset-x-0 top-0 z-10 flex h-[26px] items-center gap-[18px] px-4 text-[12px] text-white/90">
      <BrandMark className="size-3.5" />
      <span className="font-semibold">Relay</span>
      {MENUS.map((menu) => (
        <span key={menu} className="text-white/75">
          {menu}
        </span>
      ))}
      <span className="ml-auto flex items-center gap-3 text-white/75">
        <IconBattery3 className="size-4" stroke={1.6} />
        <IconWifi className="size-3.5" stroke={2} />
        <span>Wed 9:41 AM</span>
      </span>
    </div>
  );
}

const DOCK: { slug: string; bg: string; fg: string }[] = [
  { slug: "googlesearchconsole", bg: "#fff", fg: "#458cf5" },
  { slug: "googleanalytics", bg: "#fff", fg: "#e37400" },
  { slug: "claude", bg: "#d97757", fg: "#fff" },
  { slug: "openai", bg: "#000", fg: "#fff" },
  { slug: "cursor", bg: "#1b1b1b", fg: "#fff" },
  { slug: "notion", bg: "#fff", fg: "#000" },
];

/** The framed desktop's dock, with Relay open. */
function Dock() {
  return (
    <div className="landing-dock absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
      <span className="relative grid size-[38px] place-items-center rounded-[10px] bg-black ring-1 ring-white/15">
        <BrandMark className="size-[30px]" />
        <span className="absolute -bottom-[3px] size-[3px] rounded-full bg-white/80" />
      </span>
      {DOCK.map(({ slug, bg, fg }) => (
        <span
          key={slug}
          className="grid size-[38px] place-items-center rounded-[10px]"
          style={{ background: bg }}
        >
          <Logo slug={slug} color={fg} className="size-5" />
        </span>
      ))}
    </div>
  );
}
