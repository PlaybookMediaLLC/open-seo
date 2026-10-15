import {
  IconBookmark,
  IconChartLine,
  IconClipboardCheck,
  IconFlask,
  IconLayoutDashboard,
  IconLink,
  IconSearch,
  IconTarget,
  IconTrendingUp,
  IconWorld,
  type Icon,
} from "@tabler/icons-react";
import { cn } from "cn";
import { BrandMark } from "@/client/components/BrandMark";

const NAV: { group: string; items: [string, Icon][] }[] = [
  {
    group: "Overview",
    items: [
      ["Dashboard", IconLayoutDashboard],
      ["Opportunities", IconTarget],
      ["Experiments", IconFlask],
    ],
  },
  {
    group: "Research",
    items: [
      ["Keyword Research", IconSearch],
      ["Domain Overview", IconWorld],
      ["Backlinks", IconLink],
    ],
  },
  {
    group: "My Site",
    items: [
      ["Rank Tracking", IconTrendingUp],
      ["Saved Keywords", IconBookmark],
      ["Site Audit", IconClipboardCheck],
      ["Prompt Tracking", IconChartLine],
    ],
  },
];

const ROWS: [string, string, string, string][] = [
  ["/pricing", "Rewrite title and description", "18.4k impr · pos 4.2", "+640"],
  ["/blog/seo-audit", "Add an FAQ section", "6.2k impr · pos 8.1", "+310"],
  ["/features", "Fix duplicate meta description", "4.8k impr · pos 11", "+190"],
  ["/integrations", "Target “seo api”", "2.9k impr · pos 14", "+120"],
];

/**
 * A high-fidelity still of the OpenSEO app, drawn in markup so it stays sharp
 * at any size and needs no screenshot asset. `lifted` turns on the content
 * once the window has risen into view.
 */
export function AppWindow({ lifted = true }: { lifted?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0b] shadow-[0_60px_140px_-40px_rgb(0_0_0/0.9)] sm:rounded-2xl">
      <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-[#121214] px-3 py-2.5">
        <span className="size-[9px] rounded-full bg-[#ff5f57]" />
        <span className="size-[9px] rounded-full bg-[#febc2e]" />
        <span className="size-[9px] rounded-full bg-[#28c840]" />
        <span className="mx-auto rounded-md bg-white/[0.06] px-3 py-0.5 text-[10px] text-white/40">
          seo.playbookmedia.io
        </span>
      </div>
      <div className="grid grid-cols-[150px_1fr] sm:grid-cols-[180px_1fr]">
        <Sidebar />
        <Main lifted={lifted} />
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <div className="hidden flex-col gap-3 border-r border-white/[0.06] bg-[#0d0d0f] p-3 sm:flex">
      <div className="flex items-center gap-2 px-1">
        <BrandMark className="size-4" />
        <span className="text-[12px] font-semibold text-white">OpenSEO</span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.04] p-1.5">
        <span className="grid size-5 place-items-center rounded bg-white text-[9px] font-semibold text-black">
          P
        </span>
        <span className="leading-tight">
          <span className="block text-[10px] font-medium text-white">
            Playbook Media
          </span>
          <span className="block text-[9px] text-white/40">
            playbookmedia.io
          </span>
        </span>
      </div>
      {NAV.map(({ group, items }) => (
        <div key={group}>
          <p className="px-1.5 pb-1 text-[8.5px] font-medium uppercase tracking-wider text-white/30">
            {group}
          </p>
          {items.map(([label, Icon]) => (
            <p
              key={label}
              className={cn(
                "flex items-center gap-2 rounded-md px-1.5 py-[5px] text-[10.5px]",
                label === "Opportunities"
                  ? "bg-white/[0.08] font-medium text-white"
                  : "text-white/45",
              )}
            >
              <Icon className="size-3" stroke={1.7} />
              {label}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function Main({ lifted }: { lifted: boolean }) {
  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[9px] font-medium uppercase tracking-wider text-white/35">
            Your website
          </p>
          <p className="mt-0.5 text-[17px] font-semibold tracking-[-0.4px] text-white sm:text-[20px]">
            Opportunities
          </p>
        </div>
        <span className="rounded-md bg-white px-2.5 py-1 text-[10px] font-medium text-black">
          Review 4
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["Clicks", "12,480", "+18%"],
          ["Impressions", "384k", "+7%"],
          ["Avg. position", "9.4", "-1.8"],
        ].map(([label, value, delta]) => (
          <div
            key={label}
            className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5"
          >
            <p className="text-[9px] text-white/40">{label}</p>
            <p className="mt-0.5 text-[15px] font-semibold tracking-[-0.3px] text-white">
              {value}
            </p>
            <p className="text-[9px] text-[#1cecbb]">{delta}</p>
          </div>
        ))}
      </div>

      <Sparkline lifted={lifted} />

      <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.07]">
        <div className="grid grid-cols-[1.1fr_1.5fr_1fr_auto] gap-2 border-b border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[9px] uppercase tracking-wider text-white/35">
          <span>Page</span>
          <span>Recommended fix</span>
          <span className="hidden sm:block">Signal</span>
          <span>Clicks</span>
        </div>
        {ROWS.map(([page, fix, signal, gain], index) => (
          <div
            key={page}
            className={cn(
              "grid grid-cols-[1.1fr_1.5fr_1fr_auto] items-center gap-2 px-3 py-2 text-[10.5px] transition-opacity duration-700",
              index > 0 && "border-t border-white/[0.05]",
              lifted ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDelay: `${index * 90}ms` }}
          >
            <span className="truncate font-mono text-[10px] text-[#9cc0ff]">
              {page}
            </span>
            <span className="truncate text-white/85">{fix}</span>
            <span className="hidden truncate text-white/35 sm:block">
              {signal}
            </span>
            <span className="rounded-full bg-[#1cecbb]/12 px-2 py-0.5 text-[9.5px] font-medium text-[#1cecbb]">
              {gain}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SERIES = [18, 24, 21, 32, 29, 44, 40, 56, 62, 58, 74, 88];

function Sparkline({ lifted }: { lifted: boolean }) {
  const path = SERIES.map(
    (value, index) => `${index === 0 ? "M" : "L"}${index * 40} ${100 - value}`,
  ).join(" ");
  return (
    <div className="mt-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
      <svg viewBox="0 0 440 100" className="h-20 w-full" aria-hidden>
        <defs>
          <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9cc0ff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#9cc0ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L440 100 L0 100Z`} fill="url(#spark)" />
        <path
          d={path}
          fill="none"
          stroke="#9cc0ff"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength={1}
          style={{
            strokeDasharray: 1,
            strokeDashoffset: lifted ? 0 : 1,
            transition: "stroke-dashoffset 1.6s ease-out",
          }}
        />
      </svg>
    </div>
  );
}
