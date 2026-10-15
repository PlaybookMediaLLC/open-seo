import {
  IconArrowRight,
  IconFileDescription,
  IconHeading,
  IconLink,
} from "@tabler/icons-react";
import { Logo } from "./LandingPrimitives";

/* One bold, legible piece of the real UI per "What's inside" card, in the
   spirit of superwhisper's card widgets. */

export function OpportunityArt() {
  const score = 92;
  return (
    <div className="landing-glass mt-4 flex w-[248px] bg-white/[0.08] items-center gap-4 rounded-[28px] p-4">
      <span className="relative grid size-[68px] shrink-0 place-items-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="rgb(255 255 255 / 0.12)"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="#dd55e7"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 97.4} 97.4`}
          />
        </svg>
        <span className="text-[22px] font-semibold tracking-[-0.6px] text-white">
          {score}
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-white/45">
          Priority · ~1 h
        </span>
        <span className="mt-0.5 block text-[14px] font-medium leading-snug text-white">
          Rewrite the title and description on /pricing
        </span>
      </span>
    </div>
  );
}

export function RankArt() {
  return (
    <div className="mt-2 w-[252px]">
      <p className="mb-2 text-[12px] font-medium text-white/70">
        Track a keyword
      </p>
      <div className="flex items-center gap-2">
        <span className="flex h-9 flex-1 items-center rounded-lg border border-white/15 bg-black/40 px-3 text-[13px] text-white">
          rank tracking api
          <span className="landing-caret ml-px h-[16px] w-[2px] rounded-[3px] bg-[#1cecbb]" />
        </span>
        <span className="flex h-9 items-center rounded-lg bg-[#1cecbb] px-3 text-[13px] font-medium text-black">
          Track
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        {[
          ["ai content optimization", 4, 1],
          ["indie hacker seo", 7, 3],
          ["local seo services", 12, 5],
        ].map(([keyword, from, to]) => (
          <div
            key={keyword}
            className="flex items-center justify-between rounded-lg bg-white/[0.07] px-3 py-2 text-[12px]"
          >
            <span className="text-white/80">{keyword}</span>
            <span className="flex items-center gap-1 tabular-nums text-white/45">
              {from}
              <IconArrowRight className="size-3" />
              <span className="rounded bg-[#1cecbb]/20 px-1.5 font-medium text-[#1cecbb]">
                {to}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KeywordArt() {
  const rows = [
    ["keyword clustering", "2.9k", 0.3],
    ["technical seo audit", "3.6k", 0.55],
    ["seo audit checklist", "6.6k", 1],
    ["semrush alternative", "8.1k", 0.55],
    ["best seo tools", "4.4k", 0.3],
  ] as const;
  return (
    <div className="w-full space-y-1 pl-7 [mask-image:linear-gradient(90deg,#000_70%,transparent)]">
      {rows.map(([keyword, volume, opacity]) => (
        <p
          key={keyword}
          className="whitespace-nowrap text-[25px] font-semibold leading-[34px] tracking-[-0.7px] text-white"
          style={{ opacity }}
        >
          {keyword}
          <span className="ml-2 text-[13px] font-medium tracking-normal text-[#5aa9ff]">
            {volume}
          </span>
        </p>
      ))}
    </div>
  );
}

export function ExperimentArt() {
  const tests = [
    { label: "Title", icon: IconHeading, active: true },
    { label: "Meta", icon: IconFileDescription },
    { label: "Links", icon: IconLink },
  ];
  return (
    <div className="landing-glass ml-16 mt-2 rounded-[32px] bg-[#3a3a3c]/50 p-5">
      <div className="flex items-center gap-3">
        {tests.map(({ label, icon: Icon, active }) => (
          <div key={label} className="flex flex-col items-center">
            <span
              className="mb-2 grid size-[64px] place-items-center rounded-[22px] text-[#1c1c1e]"
              style={
                active
                  ? {
                      background: "#fff",
                      boxShadow:
                        "0 0 0 3px #ff5252, 0 4px 10px rgb(0 0 0 / 0.2)",
                      transform: "scale(1.05)",
                    }
                  : {
                      background: "#dadbdd",
                      boxShadow: "0 4px 6px rgb(0 0 0 / 0.1)",
                    }
              }
            >
              <Icon className="size-7" stroke={1.8} />
            </span>
            <span
              className="rounded-full px-3 py-0.5 text-[12px]"
              style={
                active
                  ? { background: "#ff5252", color: "#fff" }
                  : { color: "rgb(255 255 255 / 0.7)" }
              }
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConsoleArt() {
  return (
    <div className="landing-glass mt-2 w-[252px] rounded-[22px] bg-white/[0.08] p-4">
      <div className="flex items-center justify-between text-[11px] text-white/55">
        <span className="flex items-center gap-1.5">
          <Logo slug="googlesearchconsole" className="size-3.5 text-white/70" />
          Clicks · last 28 days
        </span>
        <span className="font-medium text-[#17c253]">+18%</span>
      </div>
      <p className="mt-1 text-[30px] font-semibold tracking-[-0.9px] text-white">
        12.4k
      </p>
      <svg viewBox="0 0 200 56" className="mt-1 h-14 w-full" aria-hidden>
        <defs>
          <linearGradient id="landing-console-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#17c253" stopOpacity="0.45" />
            <stop offset="1" stopColor="#17c253" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 44 C20 42 30 46 45 38 S70 34 85 36 110 24 125 26 150 18 165 14 185 10 200 6 V56 H0Z"
          fill="url(#landing-console-fill)"
        />
        <path
          d="M0 44 C20 42 30 46 45 38 S70 34 85 36 110 24 125 26 150 18 165 14 185 10 200 6"
          fill="none"
          stroke="#17c253"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

export function ReportArt() {
  return (
    <div className="relative mt-2">
      <div className="w-[214px] -rotate-3 rounded-2xl bg-[#f6f4ec] p-4 text-black shadow-[0_24px_48px_-16px_rgb(0_0_0/0.8)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-black/40">
          Monthly SEO report
        </p>
        <p className="mt-1 text-[15px] font-semibold leading-tight">
          acme-demo.com
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            ["Clicks", "+18%"],
            ["Avg. position", "8.2"],
          ].map(([label, value]) => (
            <span
              key={label}
              className="rounded-lg bg-black/[0.05] px-2 py-1.5"
            >
              <span className="block text-[9px] text-black/45">{label}</span>
              <span className="block text-[15px] font-semibold">{value}</span>
            </span>
          ))}
        </div>
        <div className="mt-3 space-y-1.5">
          {[100, 86, 64].map((width) => (
            <span
              key={width}
              className="block h-1.5 rounded-full bg-black/10"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      </div>
      <span className="absolute -bottom-3 -right-6 flex items-center gap-1.5 rounded-full bg-[#ffdd00] px-3 py-1.5 text-[12px] font-medium text-black shadow-[0_8px_20px_-6px_rgb(0_0_0/0.6)]">
        <IconLink className="size-3.5" stroke={2} />
        Copy link
      </span>
    </div>
  );
}
