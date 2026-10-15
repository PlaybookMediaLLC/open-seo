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
  IconBrandReddit,
  IconBrandSlack,
  IconBrandStripe,
  IconBrandVercel,
  IconBrandVscode,
  IconBrandWebflow,
  IconBrandWordpress,
  IconBrandX,
  IconBrandYoutube,
  IconChartBar,
  IconCloud,
  IconCpu,
  IconMessageChatbot,
  IconRepeat,
  IconShoppingBag,
  IconSparkles,
  IconTerminal2,
  type Icon,
} from "@tabler/icons-react";
import { cn } from "cn";
import { Eyebrow, Reveal } from "./LandingPrimitives";

function Point({
  icon: Icon,
  color,
  title,
  body,
}: {
  icon: Icon;
  color: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-4">
      <Icon className="mt-0.5 size-6 shrink-0" style={{ color }} stroke={1.5} />
      <div>
        <p className="text-[16px] font-medium leading-6 text-[#fafafa]">
          {title}
        </p>
        <p className="mt-0.5 max-w-[330px] text-[15px] leading-[22px] text-[#888b91]">
          {body}
        </p>
      </div>
    </div>
  );
}

export function LandingBuildIt() {
  return (
    <section className="w-full overflow-hidden px-4 py-28">
      <Reveal className="mx-auto grid max-w-[1024px] items-center gap-10 md:grid-cols-2">
        <SettingsMock />
        <div>
          <Eyebrow color="#0088ff">Project context</Eyebrow>
          <h2 className="mt-4 text-[40px] font-medium leading-[44px] tracking-[-1px] text-[#fafafa] sm:text-[48px] sm:leading-[51px]">
            Tune it yourself
          </h2>
          <p className="mt-3 max-w-[380px] text-[16px] leading-[22.4px] text-[#888b91]">
            Context lets you define how OpenSEO researches, prioritizes and
            reports. Down to the finest detail.
          </p>
          <div className="mt-10 space-y-8">
            <Point
              icon={IconAdjustmentsHorizontal}
              color="#0088ff"
              title="Beyond keywords: positioning"
              body="Set goals, audiences and competitors once. Research and reports follow them."
            />
            <Point
              icon={IconCpu}
              color="#0088ff"
              title="Pick the right model for the job"
              body="Use Claude, GPT or Gemini through your own agent, or the built-in assistant."
            />
            <Point
              icon={IconRepeat}
              color="#0088ff"
              title="Consistent every week"
              body="Saved keywords, tracked ranks and recurring audits keep the signal steady."
            />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/** The tilted settings window from superwhisper's "Build it yourself". */
function SettingsMock() {
  const nav = ["Dashboard", "Opportunities", "Keywords", "Context"];
  return (
    <div className="relative h-[300px] [perspective:1400px]">
      <div className="absolute left-0 top-0 w-[400px] rounded-[14px] border border-white/10 bg-[#141416] p-3 shadow-[0_40px_100px_-20px_#000] [transform:rotateX(12deg)_rotateY(-16deg)_rotateZ(5deg)]">
        <div className="mb-3 flex gap-1.5">
          <span className="size-2 rounded-full bg-[#ff5f57]" />
          <span className="size-2 rounded-full bg-[#febc2e]" />
          <span className="size-2 rounded-full bg-[#28c840]" />
        </div>
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <div className="space-y-1">
            {nav.map((item) => (
              <p
                key={item}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px]",
                  item === "Context"
                    ? "bg-white/10 text-white"
                    : "text-white/45",
                )}
              >
                {item}
              </p>
            ))}
          </div>
          <div className="space-y-2">
            {[
              ["Site", "playbookmedia.io"],
              ["Goal", "Grow demo signups"],
              ["Audience", "B2B marketers"],
              ["Rivals", "semrush, ahrefs"],
            ].map(([key, value]) => (
              <div
                key={key}
                className="flex justify-between rounded-md bg-white/[0.05] px-2 py-1.5 text-[11px]"
              >
                <span className="text-white/45">{key}</span>
                <span className="text-white/90">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute left-52 top-36 w-[180px] rounded-[12px] border border-white/10 bg-[#1c1c1f] p-2 shadow-[0_30px_60px_-10px_#000] [transform:rotateX(12deg)_rotateY(-16deg)_rotateZ(5deg)]">
        <p className="px-1.5 pb-1 text-[10px] font-semibold text-white/50">
          Assistant
        </p>
        {["Claude Sonnet 4.5", "GPT-5", "Gemini 3 Flash", "Llama 4"].map(
          (model, index) => (
            <p
              key={model}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px]",
                index === 0 ? "bg-white/10 text-white" : "text-white/70",
              )}
            >
              <IconSparkles className="size-3 text-[#0088ff]" /> {model}
            </p>
          ),
        )}
      </div>
    </div>
  );
}

const KEYS: { icon: Icon; color: string; bg: string }[][] = [
  [
    { icon: IconBrandGoogle, color: "#4285f4", bg: "#fff" },
    { icon: IconChartBar, color: "#fff", bg: "#f9ab00" },
    { icon: IconBrandSlack, color: "#fff", bg: "#4a154b" },
    { icon: IconBrandNotion, color: "#000", bg: "#fff" },
    { icon: IconBrandVscode, color: "#fff", bg: "#0065a9" },
    { icon: IconBrandOpenai, color: "#fff", bg: "#10a37f" },
    { icon: IconBrandWordpress, color: "#fff", bg: "#21759b" },
    { icon: IconBrandWebflow, color: "#fff", bg: "#4353ff" },
    { icon: IconBrandFramer, color: "#fff", bg: "#000" },
  ],
  [
    { icon: IconShoppingBag, color: "#fff", bg: "#5e8e3e" },
    { icon: IconBrandGmail, color: "#ea4335", bg: "#fff" },
    { icon: IconBrandVercel, color: "#fff", bg: "#000" },
    { icon: IconCloud, color: "#fff", bg: "#f38020" },
    { icon: IconBrandStripe, color: "#fff", bg: "#635bff" },
    { icon: IconBrandFigma, color: "#fff", bg: "#1e1e1e" },
    { icon: IconBrandChrome, color: "#fbbc04", bg: "#fff" },
    { icon: IconMessageChatbot, color: "#fff", bg: "#d97757" },
  ],
  [
    { icon: IconBrandLinkedin, color: "#fff", bg: "#0a66c2" },
    { icon: IconBrandX, color: "#fff", bg: "#000" },
    { icon: IconBrandYoutube, color: "#fff", bg: "#ff0000" },
    { icon: IconBrandReddit, color: "#fff", bg: "#ff4500" },
    { icon: IconTerminal2, color: "#fff", bg: "#1e1e1e" },
  ],
];

export function LandingIntegrations() {
  return (
    <section className="w-full overflow-hidden px-4 pb-20 pt-32 text-center">
      <Reveal>
        <Eyebrow color="#83c9ff">Integrations</Eyebrow>
        <h2 className="mt-3 text-[36px] font-semibold leading-[38px] text-[#70757c] sm:text-[48px] sm:leading-[51px]">
          Works <span className="text-[#fafafa]">anywhere</span>
          <br />
          you publish
        </h2>
        <p className="mt-5 text-[16px] leading-[22.4px] text-[#fafafa]">
          WordPress, Webflow, Next.js…
        </p>
        <p className="text-[16px] leading-[22.4px] text-[#888b91]">
          You approve it, OpenSEO ships it.
        </p>
      </Reveal>
      <div className="relative mx-auto mt-14 h-[300px] max-w-[900px] overflow-hidden">
        <div className="absolute left-1/2 top-4 w-[700px] -translate-x-1/2 rotate-[3deg] rounded-[13px] border-[1.5px] border-[#999] bg-gradient-to-b from-[#7e7e7e] to-[#4e4e4e] p-2 shadow-[0_0_45px_0_#000]">
          {KEYS.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="mb-1 flex gap-1"
              style={{ paddingLeft: 14 + rowIndex * 18 }}
            >
              <Blank wide />
              {row.map(({ icon: KeyIcon, color, bg }, i) => (
                <span
                  key={i}
                  className="grid size-[42px] shrink-0 place-items-center rounded-[8px] shadow-[inset_0_-3px_0_rgb(0_0_0/0.25),0_1px_0_rgb(255_255_255/0.25)]"
                  style={{ background: bg }}
                >
                  <KeyIcon className="size-6" style={{ color }} stroke={1.8} />
                </span>
              ))}
              <Blank grow />
            </div>
          ))}
          <div className="flex gap-1">
            {[1, 1, 1, 7, 1, 1].map((w, i) => (
              <span
                key={i}
                className="h-[42px] rounded-[8px] bg-[#2a2a2c] shadow-[inset_0_-3px_0_#111]"
                style={{ flex: w }}
              />
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-black" />
      </div>
    </section>
  );
}

function Blank({ wide, grow }: { wide?: boolean; grow?: boolean }) {
  return (
    <span
      className={cn(
        "h-[42px] shrink-0 rounded-[8px] bg-[#2a2a2c] shadow-[inset_0_-3px_0_#111]",
        wide && "w-[42px]",
        grow && "flex-1",
      )}
    />
  );
}

export function LandingAgents() {
  return (
    <section id="agents" className="w-full px-4 pb-32 pt-10">
      <Reveal className="mx-auto grid max-w-[1024px] items-center gap-12 md:grid-cols-[1fr_1.45fr]">
        <div>
          <Eyebrow color="#ffdd00" className="font-normal tracking-normal">
            Beep boop
          </Eyebrow>
          <h2 className="mt-3 text-[30px] font-normal leading-9 tracking-[-0.75px] text-[#fafafa]">
            Faster agentic SEO
          </h2>
          <p className="mt-2 max-w-[360px] text-[16px] leading-[22.4px] text-[#c4c5c9]">
            Use OpenSEO with Claude Code, Codex, Cursor or any other MCP client,
            without opening a dashboard.
          </p>
          <div className="mt-12 space-y-10">
            <Point
              icon={IconAdjustmentsHorizontal}
              color="#ffdd00"
              title="Works where you code"
              body="One MCP URL gives your agent keyword, SERP, backlink and audit tools."
            />
            <Point
              icon={IconCpu}
              color="#ffdd00"
              title="Less clicking, more shipping"
              body="Ask for a competitor gap analysis and get the report back in minutes."
            />
          </div>
        </div>
        <Terminal />
      </Reveal>
    </section>
  );
}

function Terminal() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0d0d0d]">
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2.5">
        <span className="size-3 rounded-full bg-[#ff5f57]" />
        <span className="size-3 rounded-full bg-[#febc2e]" />
        <span className="size-3 rounded-full bg-[#28c840]" />
      </div>
      <div className="relative h-[340px] p-4 font-mono text-[11.5px] leading-[1.5]">
        <div className="grid grid-cols-[1.6fr_1fr] border border-[#e6714f]/70 p-3">
          <div className="text-center text-white/70">
            <p className="-mt-6 mb-2 w-fit bg-[#0d0d0d] px-1 text-left text-[#e6714f]">
              Claude Code
            </p>
            <p>Welcome back!</p>
            <p className="my-2 text-[22px] leading-none text-[#e6714f]">▟█▙</p>
            <p className="text-white/45">openseo MCP · 24 tools</p>
          </div>
          <div className="border-l border-[#e6714f]/70 pl-3 text-white/45">
            <p className="text-[#e6714f]">Tips</p>
            <p>Ask for a keyword gap…</p>
            <p className="mt-1 text-[#e6714f]">Recent</p>
            <p>No recent activity</p>
          </div>
        </div>
        <div className="mt-4 space-y-1 text-white/60">
          <p>
            <span className="text-[#7b61ff]">❯</span>{" "}
            <span className="text-white">
              find keywords where we rank 8-20 and fix the titles
            </span>
          </p>
          <p>
            <span className="text-[#27c93f]">●</span> openseo.search_performance
          </p>
          <p>
            <span className="text-[#27c93f]">●</span> openseo.keyword_research
          </p>
          <p>
            <span className="text-[#ffd700]">●</span> Update{" "}
            <span className="text-white/80">app/pricing/page.tsx</span>
          </p>
          <p className="text-[#27c93f]">
            + title: “Pricing · The SEO toolkit for builders”
          </p>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-[#0d0d0d]" />
        <div className="absolute bottom-6 left-1/2 flex h-9 -translate-x-1/2 items-center gap-[3px] rounded-full border border-white/30 bg-black px-4">
          {[0.5, 0.8, 1, 0.7, 0.4].map((h, i) => (
            <span
              key={i}
              className="landing-bar block w-[2px] rounded-full bg-white"
              style={{ height: `${h * 12}px`, animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
