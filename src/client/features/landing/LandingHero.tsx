import { Link } from "@tanstack/react-router";
import {
  IconArrowDown,
  IconArrowRight,
  IconBrandGoogle,
  IconSearch,
  IconSparkles,
  IconTrendingUp,
} from "@tabler/icons-react";
import type { ComponentType, PointerEvent } from "react";
import { BrandMark } from "@/client/components/BrandMark";
import { Reveal } from "./LandingPrimitives";

export function LandingNav({ signedIn }: { signedIn: boolean }) {
  return (
    <nav className="landing-nav" aria-label="Primary">
      <Link to="/" className="flex items-center" aria-label="OpenSEO home">
        <BrandMark className="size-[18px]" />
      </Link>
      <a href="#features" className="landing-nav-link hidden sm:inline">
        Features
      </a>
      <a href="#agents" className="landing-nav-link hidden sm:inline">
        Agents
      </a>
      <a href="#pricing" className="landing-nav-link">
        Pricing
      </a>
      <a href="#faq" className="landing-nav-link hidden sm:inline">
        FAQ
      </a>
      <Link
        to={signedIn ? "/app" : "/sign-in"}
        className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm text-black transition-colors hover:bg-white/90"
      >
        {signedIn ? "Open app" : "Sign in"}
      </Link>
    </nav>
  );
}

// The spotlight follows the pointer through CSS variables, no re-render.
function trackPointer(event: PointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty(
    "--spot-x",
    `${event.clientX - rect.left}px`,
  );
  event.currentTarget.style.setProperty(
    "--spot-y",
    `${event.clientY - rect.top}px`,
  );
}

export function LandingHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section
      onPointerMove={trackPointer}
      className="landing-sky relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 text-center"
    >
      <HeroBackdrop />
      {/* Horizon glow and a fade to the black page below. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-black" />

      <div className="relative w-[672px] max-w-full">
        <h1 className="m-0 text-[40px] font-semibold leading-[1.05] tracking-[-1.92px] text-white sm:text-[48px]">
          Just ship.
          <br />
          Rank faster.
        </h1>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link
            to={signedIn ? "/app" : "/sign-in"}
            className="landing-cta-light"
          >
            <IconBrandGoogle className="size-4" />
            {signedIn ? "Open OpenSEO" : "Continue with Google"}
          </Link>
          <a href="#features" className="landing-cta-dark">
            <IconSparkles className="size-4" />
            See what it does
          </a>
        </div>
        <a
          href="#pricing"
          className="mt-3 inline-flex items-center gap-1 text-xs text-white/50 transition-colors hover:text-white/80"
        >
          Free plan included, no card required
          <IconArrowRight className="size-3" />
        </a>
        <p className="mx-auto mt-8 max-w-sm text-[15px] leading-relaxed text-white/90">
          Turn search data into shipped improvements.
          <span className="block text-white/55">
            Works with Search Console, Analytics and your AI agent.
          </span>
        </p>
      </div>

      <a
        href="#demo"
        className="absolute bottom-8 flex flex-col items-center gap-1 text-xs text-white/50 transition-colors hover:text-white/80"
      >
        Scroll to see it work
        <IconArrowDown className="size-4" />
      </a>
    </section>
  );
}

/** Layered, animated night sky: drifting aurora, twinkling and shooting
 *  stars, a pulsing horizon and a pointer spotlight. */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="landing-aurora">
        <span className="landing-aurora-a" />
        <span className="landing-aurora-b" />
        <span className="landing-aurora-c" />
        <span className="landing-aurora-d" />
      </div>
      <div className="landing-sky-stars landing-twinkle absolute inset-0" />
      <div className="landing-sky-stars landing-twinkle landing-twinkle-alt absolute inset-0" />
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={`landing-shooting landing-shooting-${i}`} />
      ))}
      <div className="landing-horizon" />
      <div className="landing-spotlight" />
    </div>
  );
}

/** The product, framed like a window on the twilight backdrop. */
export function LandingDemo() {
  return (
    <section id="demo" className="px-4 pb-10 pt-24">
      <Reveal className="mx-auto max-w-[1040px]">
        <div className="landing-sky relative overflow-hidden rounded-2xl p-3 shadow-[0_40px_120px_-40px_rgb(91_120_200/0.6)] sm:p-10">
          <div className="landing-hairline relative overflow-hidden rounded-xl bg-[#0b0c10]/95 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-3">
              <span className="size-2.5 rounded-full bg-[#ff5f57]" />
              <span className="size-2.5 rounded-full bg-[#febc2e]" />
              <span className="size-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-xs text-white/40">
                seo.playbookmedia.io / opportunities
              </span>
            </div>
            <div className="grid gap-0 sm:grid-cols-[180px_1fr]">
              <DemoSidebar />
              <DemoBoard />
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function DemoSidebar() {
  const rows = [
    "Dashboard",
    "Opportunities",
    "Experiments",
    "Keyword Research",
    "Rank Tracking",
    "Site Audit",
  ];
  return (
    <div className="hidden flex-col gap-0.5 border-r border-white/5 p-3 sm:flex">
      {rows.map((row) => (
        <span
          key={row}
          className={
            row === "Opportunities"
              ? "rounded-md bg-white/[0.07] px-2.5 py-1.5 text-xs font-medium text-white"
              : "px-2.5 py-1.5 text-xs text-white/40"
          }
        >
          {row}
        </span>
      ))}
    </div>
  );
}

const DEMO_ROWS: {
  title: string;
  detail: string;
  gain: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  {
    title: "Rewrite title on /pricing",
    detail: "Position 4.2 · 18.4k impressions · CTR 1.1%",
    gain: "+640 clicks/mo",
    icon: IconTrendingUp,
  },
  {
    title: "Target “seo audit checklist”",
    detail: "KD 22 · 6.6k searches · you rank #14",
    gain: "+410 clicks/mo",
    icon: IconSearch,
  },
  {
    title: "Fix 3 pages missing meta descriptions",
    detail: "Found by Site Audit · 1 pull request ready",
    gain: "Ready to ship",
    icon: IconArrowRight,
  },
];

function DemoBoard() {
  return (
    <div className="p-5 sm:p-7">
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/35">
        This week
      </p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-white">
        3 opportunities worth shipping
      </p>
      <div className="mt-5 space-y-2.5">
        {DEMO_ROWS.map(({ title, detail, gain, icon: Icon }, index) => (
          <Reveal key={title} delay={150 + index * 120}>
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#2b5288]/40 text-[#9cc0ff]">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white">
                  {title}
                </span>
                <span className="block truncate text-xs text-white/45">
                  {detail}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-[#1cecbb]/10 px-2.5 py-1 text-[11px] font-medium text-[#1cecbb]">
                {gain}
              </span>
            </div>
          </Reveal>
        ))}
      </div>
      <div className="mt-5 flex items-end gap-1" aria-hidden>
        {[30, 42, 38, 55, 48, 62, 58, 71, 69, 80, 77, 92].map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-sm bg-gradient-to-t from-[#2b5288] to-[#8f86ad]"
            style={{ height: `${h * 0.6}px`, opacity: 0.35 + i * 0.05 }}
          />
        ))}
      </div>
    </div>
  );
}

const SOURCES = [
  "Google Search Console",
  "Google Analytics 4",
  "DataForSEO",
  "Claude",
  "ChatGPT",
  "Cursor",
  "Codex",
  "Cloudflare",
  "Stripe",
];

export function LandingLogos() {
  return (
    <section className="relative px-4 py-24">
      <div className="landing-dots pointer-events-none absolute inset-0" />
      <Reveal className="relative mx-auto max-w-[760px]">
        <div className="landing-marquee overflow-hidden">
          {[false, true].map((reverse) => (
            <div
              key={String(reverse)}
              className="landing-marquee-track py-2"
              data-reverse={reverse ? "" : undefined}
            >
              {[...SOURCES, ...SOURCES].map((name, i) => (
                <span
                  key={i}
                  className="mx-6 whitespace-nowrap text-[17px] font-semibold tracking-tight text-white/30"
                >
                  {name}
                </span>
              ))}
            </div>
          ))}
        </div>
        <h2 className="mt-10 text-center text-[27px] font-semibold leading-[120%] tracking-[-1.24px] text-[#fafafa] sm:text-[31px]">
          Built on the data that matters
        </h2>
        <p className="mt-3 text-center text-sm text-[#888b91]">
          Your real Google data, live SERP research,
          <br />
          and the{" "}
          <span className="text-[#fafafa]">AI agents you already use</span>.
        </p>
      </Reveal>
    </section>
  );
}
