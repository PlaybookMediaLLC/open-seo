import {
  IconAdjustmentsHorizontal,
  IconBrandChrome,
  IconBrandFigma,
  IconBrandFramer,
  IconBrandGmail,
  IconBrandGoogle,
  IconBrandLinkedin,
  IconBrandNotion,
  IconBrandOpenai,
  IconBrandSlack,
  IconBrandStripe,
  IconBrandVercel,
  IconBrandVscode,
  IconBrandWebflow,
  IconBrandWordpress,
  IconBrandX,
  IconBrandYoutube,
  IconCpu,
  IconCloud,
  IconChartBar,
  IconMessageChatbot,
  IconTerminal2,
  IconBrandReddit,
  IconShoppingBag,
  type Icon,
} from "@tabler/icons-react";
import { Eyebrow, Reveal } from "./LandingPrimitives";

type Key = { icon: Icon; color: string };

const KEYS: Key[][] = [
  [
    { icon: IconBrandGoogle, color: "#4285f4" },
    { icon: IconChartBar, color: "#f9ab00" },
    { icon: IconBrandSlack, color: "#e01e5a" },
    { icon: IconBrandNotion, color: "#ffffff" },
    { icon: IconBrandVscode, color: "#23a9f2" },
    { icon: IconBrandOpenai, color: "#10a37f" },
    { icon: IconBrandWordpress, color: "#3b82c4" },
    { icon: IconBrandWebflow, color: "#4353ff" },
  ],
  [
    { icon: IconBrandFramer, color: "#0099ff" },
    { icon: IconShoppingBag, color: "#95bf47" },
    { icon: IconBrandGmail, color: "#ea4335" },
    { icon: IconBrandVercel, color: "#ffffff" },
    { icon: IconCloud, color: "#f38020" },
    { icon: IconBrandStripe, color: "#635bff" },
    { icon: IconBrandFigma, color: "#a259ff" },
    { icon: IconBrandChrome, color: "#fbbc04" },
  ],
  [
    { icon: IconBrandLinkedin, color: "#0a66c2" },
    { icon: IconBrandX, color: "#ffffff" },
    { icon: IconBrandYoutube, color: "#ff0000" },
    { icon: IconBrandReddit, color: "#ff4500" },
    { icon: IconMessageChatbot, color: "#d97757" },
    { icon: IconTerminal2, color: "#9cc0ff" },
  ],
];

export function LandingIntegrations() {
  return (
    <section className="px-4 py-28 text-center">
      <Reveal>
        <Eyebrow>Integrations</Eyebrow>
        <h2 className="mt-3 text-[34px] font-semibold leading-[1.1] tracking-[-1.4px] sm:text-[44px]">
          <span className="text-white/45">Works </span>
          <span className="text-white">anywhere</span>
          <br />
          <span className="text-white/45">you publish</span>
        </h2>
        <p className="mt-5 text-sm text-white">WordPress, Webflow, Next.js…</p>
        <p className="text-sm text-[#888b90]">
          You approve it, OpenSEO ships it.
        </p>
      </Reveal>
      <Reveal delay={120} className="mx-auto mt-14 max-w-[620px] -rotate-2">
        <div className="rounded-[18px] border-[1.5px] border-[#999] bg-gradient-to-b from-[#7e7e7e] to-[#4e4e4e] p-2.5 shadow-[0_0_45px_0_#000]">
          {KEYS.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="mb-1.5 flex justify-center gap-1.5 last:mb-0"
              style={{ paddingLeft: rowIndex * 18 }}
            >
              <span className="h-10 w-10 rounded-md bg-[#2a2a2a] shadow-[inset_0_-2px_0_#111] sm:h-11 sm:w-14" />
              {row.map(({ icon: Icon, color }, i) => (
                <span
                  key={i}
                  className="grid size-10 place-items-center rounded-md bg-[#1d1d1f] shadow-[inset_0_-2px_0_#000,0_1px_0_#666] sm:size-11"
                >
                  <Icon className="size-5" style={{ color }} />
                </span>
              ))}
              <span className="h-10 flex-1 rounded-md bg-[#2a2a2a] shadow-[inset_0_-2px_0_#111] sm:h-11" />
            </div>
          ))}
          <div className="flex justify-center gap-1.5">
            {[1, 1, 1, 6, 1, 1].map((w, i) => (
              <span
                key={i}
                className="h-9 rounded-md bg-[#2a2a2a] shadow-[inset_0_-2px_0_#111]"
                style={{ flex: w }}
              />
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function LandingAgents() {
  return (
    <section id="agents" className="px-4 py-20">
      <Reveal className="mx-auto grid max-w-[960px] items-center gap-12 md:grid-cols-[1fr_1.2fr]">
        <div>
          <Eyebrow className="text-[#ffd700]">Beep boop</Eyebrow>
          <h2 className="mt-3 text-[34px] font-semibold leading-[1.1] tracking-[-1.4px] text-white sm:text-[40px]">
            Your agent’s SEO toolkit
          </h2>
          <p className="mt-3 max-w-[380px] text-sm leading-relaxed text-white/60">
            Connect Claude Code, Codex, Cursor or any MCP client and let it
            research, audit and report without touching a dashboard.
          </p>
          <div className="mt-8 space-y-6">
            {[
              {
                icon: IconAdjustmentsHorizontal,
                title: "Works where you code",
                body: "One MCP URL gives your agent keyword, SERP, backlink and audit tools.",
              },
              {
                icon: IconCpu,
                title: "Less clicking, more shipping",
                body: "Ask for a competitor gap analysis and get a report back in minutes.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <Icon className="mt-0.5 size-5 shrink-0 text-[#ffd700]" />
                <div>
                  <p className="text-[15px] text-white">{title}</p>
                  <p className="mt-1 max-w-[340px] text-sm leading-relaxed text-white/45">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <Terminal />
      </Reveal>
    </section>
  );
}

function Terminal() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0c] font-mono text-[12px] leading-relaxed shadow-[0_30px_80px_-30px_rgb(0_0_0)]">
      <div className="flex items-center gap-1.5 border-b border-white/5 px-3 py-2.5">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[11px] text-white/35">~/dev/site</span>
      </div>
      <div className="space-y-1.5 p-4">
        <p className="rounded border border-[#e6714f]/40 p-2 text-white/50">
          <span className="text-[#e6714f]">✻</span> Welcome back!{" "}
          <span className="text-white/35">· openseo MCP connected</span>
        </p>
        <p>
          <span className="text-[#7b61ff]">❯</span>{" "}
          <span className="text-white">
            find keywords where we rank 8-20 and draft fixes
          </span>
        </p>
        <p className="text-white/50">
          <span className="text-[#27c93f]">●</span> openseo.search_performance
          <span className="text-white/30"> (last 28 days)</span>
        </p>
        <p className="text-white/50">
          <span className="text-[#27c93f]">●</span> openseo.keyword_research
          <span className="text-white/30"> (14 candidates)</span>
        </p>
        <p className="text-white/50">
          <span className="text-[#ffd700]">●</span> Update{" "}
          <span className="text-white/70">app/pricing/page.tsx</span>
        </p>
        <p className="text-[#27c93f]">
          + title: “Pricing · The SEO toolkit for builders, from $0”
        </p>
        <p className="text-[#27c93f]">
          + description: “Rank tracking, audits…”
        </p>
      </div>
      <div className="flex justify-center pb-4">
        <span className="flex h-7 items-center gap-[3px] rounded-full border border-white/20 px-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="landing-bar block h-3 w-[2px] rounded-full bg-white"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
