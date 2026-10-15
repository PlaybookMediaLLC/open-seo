import { useEffect, useRef } from "react";
import {
  IconAdjustmentsHorizontal,
  IconCpu,
  type Icon,
} from "@tabler/icons-react";
import { cn } from "cn";
import { Eyebrow, Logo, Reveal } from "./LandingPrimitives";

const APPS: [string, string, string][][] = [
  [
    ["googlesearchconsole", "#fff", "#458cf5"],
    ["googleanalytics", "#fff", "#e37400"],
    ["claude", "#d97757", "#fff"],
    ["openai", "#000", "#fff"],
    ["cursor", "#1b1b1b", "#fff"],
    ["perplexity", "#0f2324", "#1fb8cd"],
    ["googlegemini", "#fff", "#4f7df3"],
    ["notion", "#fff", "#000"],
    ["github", "#181717", "#fff"],
    ["wordpress", "#21759b", "#fff"],
    ["webflow", "#146ef5", "#fff"],
    ["shopify", "#7ab55c", "#fff"],
  ],
  [
    ["wix", "#0c6efc", "#fff"],
    ["squarespace", "#fff", "#000"],
    ["ghost", "#15171a", "#fff"],
    ["framer", "#0055ff", "#fff"],
    ["nextdotjs", "#000", "#fff"],
    ["vercel", "#fff", "#000"],
    ["netlify", "#0e1e25", "#00c7b7"],
    ["cloudflare", "#fff", "#f38020"],
    ["astro", "#bc52ee", "#fff"],
    ["linear", "#5e6ad2", "#fff"],
    ["figma", "#1e1e1e", "#f24e1e"],
  ],
  [
    ["zapier", "#ff4f00", "#fff"],
    ["n8n", "#ea4b71", "#fff"],
    ["hubspot", "#ff7a59", "#fff"],
    ["gmail", "#fff", "#ea4335"],
    ["googlesheets", "#34a853", "#fff"],
    ["googledocs", "#4285f4", "#fff"],
    ["googletagmanager", "#fff", "#246fdb"],
    ["youtube", "#ff0000", "#fff"],
    ["reddit", "#ff4500", "#fff"],
    ["x", "#000", "#fff"],
    ["substack", "#ff6719", "#fff"],
  ],
];

function Key({ className }: { className?: string }) {
  return (
    <span className={cn("landing-key", className)}>
      <span className="landing-key-inner" />
    </span>
  );
}

function AppKey({ app: [slug, bg, fg] }: { app: [string, string, string] }) {
  return (
    <span className="landing-key">
      <span
        className="landing-key-inner landing-key-app"
        style={{ backgroundColor: bg }}
      >
        <Logo slug={slug} color={fg} className="size-[22px]" />
      </span>
    </span>
  );
}

export function LandingIntegrations() {
  const section = useRef<HTMLElement>(null);
  const keyboard = useRef<HTMLDivElement>(null);

  // The keyboard rises and turns with the scroll, as on superwhisper.
  useEffect(() => {
    const scroller = document.querySelector(".landing-scroll");
    const node = section.current;
    if (!scroller || !node) return;
    let queued = false;
    const apply = () => {
      queued = false;
      const top = node.getBoundingClientRect().top;
      // Rises into place, then drifts slowly so it never covers the title.
      const lift = Math.min(400, (top - 57) * (top > 57 ? 0.92 : 0.2));
      const turn = Math.max(-20, Math.min(8, -2.5 + (59 - top) * 0.027));
      const fit = Math.min(1, (window.innerWidth - 24) / 748);
      if (keyboard.current) {
        keyboard.current.style.transform = `translateX(-50%) translateY(${lift}px) rotate(${turn}deg) scale(${fit})`;
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

  const [top, middle, bottom] = APPS;
  return (
    <section
      id="integrations"
      ref={section}
      className="relative h-[766px] w-full overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 z-10 hidden bg-[radial-gradient(circle_at_center,transparent_0,#000_50%)] md:block" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black to-transparent to-15%" />
      <div className="absolute top-[100px] z-20 flex w-full flex-col items-center px-4 text-center">
        <Eyebrow>Integrations</Eyebrow>
        <h2 className="mt-4 max-w-[530px] px-8 text-[40px] font-semibold leading-[44px] text-(--l-text-3) sm:text-[48px] sm:leading-[51px]">
          Works <span className="text-(--l-text)">anywhere</span>
          <br />
          you publish
        </h2>
        <p className="mt-6 w-[380px] max-w-full text-[16px] leading-[22.4px] text-(--l-text)">
          WordPress, Webflow, Next.js…
          <br />
          <span className="text-(--l-text-2)">
            You approve it, Relay ships it.
          </span>
        </p>
      </div>
      <div ref={keyboard} aria-hidden className="landing-keyboard">
        <div className="landing-keyboard-row">
          {Array.from({ length: 13 }, (_, i) => (
            <Key key={i} />
          ))}
          <Key className="landing-key-tab" />
        </div>
        <div className="landing-keyboard-row">
          <Key className="landing-key-tab" />
          {top?.map((app) => (
            <AppKey key={app[0]} app={app} />
          ))}
          <Key className="landing-key-enter" />
        </div>
        <div className="landing-keyboard-row">
          <Key className="landing-key-caps" />
          {middle?.map((app) => (
            <AppKey key={app[0]} app={app} />
          ))}
          <Key className="landing-key-return" />
        </div>
        <div className="landing-keyboard-row">
          <Key className="landing-key-cmd" />
          {bottom?.map((app) => (
            <AppKey key={app[0]} app={app} />
          ))}
          <Key className="landing-key-shift" />
        </div>
        <div className="landing-keyboard-row">
          <Key />
          <Key />
          <Key />
          <Key className="landing-key-cmd" />
          <Key className="landing-key-space" />
          <Key className="landing-key-cmd" />
          <Key />
          <Key className="landing-key-half landing-key-side" />
          <span className="flex flex-col">
            <Key className="landing-key-half landing-key-up" />
            <Key className="landing-key-half landing-key-down" />
          </span>
          <Key className="landing-key-half landing-key-side" />
        </div>
      </div>
    </section>
  );
}

export function LandingAgents() {
  return (
    <section
      id="agents"
      className="flex w-full flex-col items-center gap-y-12 px-6 pb-32 pt-32 md:flex-row md:justify-center md:gap-x-12 md:gap-y-0 md:px-0"
    >
      <Reveal className="flex w-full max-w-[350px] flex-col md:z-40">
        <Eyebrow>Agents</Eyebrow>
        <h2 className="mt-4 text-3xl tracking-tight text-(--l-text)">
          Faster agentic SEO
        </h2>
        <p className="mt-2 text-sm text-(--l-text-2)">
          Use Relay with Claude Code, Codex, Cursor, ChatGPT or any other MCP
          client, without opening a dashboard.
        </p>
        <AgentPoint
          icon={IconAdjustmentsHorizontal}
          title="Works where you code"
          body="One MCP URL gives your agent 76 tools: keywords, SERPs, backlinks, audits and your Search Console data."
        />
        <AgentPoint
          icon={IconCpu}
          title="Less clicking, more shipping"
          body="Ask for a competitor gap analysis and get the fix as a pull request, not a spreadsheet."
        />
      </Reveal>
      <Reveal delay={120} className="w-full max-w-[582px]">
        <Terminal />
      </Reveal>
    </section>
  );
}

function AgentPoint({
  icon: Icon,
  title,
  body,
}: {
  icon: Icon;
  title: string;
  body: string;
}) {
  return (
    <div className="mt-12 flex items-center">
      <Icon className="mr-4 size-6 shrink-0 text-(--l-text-2)" stroke={1.5} />
      <div>
        <p className="text-base font-medium text-(--l-text)">{title}</p>
        <p className="text-sm text-(--l-text-2)">{body}</p>
      </div>
    </div>
  );
}

const SESSION: [string, string][] = [
  ["tool", "relay - get_search_console_performance (MCP)"],
  ["dim", "  ⎿  14 queries rank between 8 and 20"],
  ["tool", "relay - get_serp_results (MCP)"],
  ["dim", "  ⎿  Top 10 for “seo audit checklist”"],
  ["text", "The /pricing title hides the price. I’ll rewrite it."],
  ["edit", "Update(app/pricing/page.tsx)"],
  ["del", "  12 -   title: “Pricing”,"],
  ["add", "  12 +   title: “Pricing: plans from $0 · Relay”,"],
];

const SESSION_STYLE: Record<string, string> = {
  tool: "text-white/90",
  dim: "text-white/45",
  text: "text-white/80",
  edit: "text-white/90",
  del: "text-white/35",
  add: "text-white",
};

/** A Claude Code session that runs Relay tools, line by line. */
function Terminal() {
  return (
    <div className="relative h-[399px] overflow-hidden rounded-[11px] border border-[#2d2d2d] bg-[#0b0b0b] shadow-[0_3px_20px_0_rgb(0_0_0/0.25)]">
      <div className="flex gap-[7px] border-b border-[#2d2d2d] p-[10px]">
        <span className="size-[11px] rounded-full bg-white/15" />
        <span className="size-[11px] rounded-full bg-white/15" />
        <span className="size-[11px] rounded-full bg-white/15" />
      </div>
      <div className="px-4 py-3 font-mono text-[11px] text-white">
        <div className="relative grid grid-cols-[1.7fr_1fr] rounded-[3px] border border-white/25 px-3 pb-2.5 pt-3.5">
          <p className="absolute -top-[8px] left-3 bg-[#0b0b0b] px-1 text-white/70">
            Claude Code <span className="text-white/50">v2.1.12</span>
          </p>
          <div className="text-center leading-[1.25]">
            <p>Welcome back!</p>
            <pre className="my-2 font-mono leading-none text-white/70">
              {" ▐▛███▜▌\n▝▜█████▛▘\n  ▘▘ ▝▝  "}
            </pre>
            <p className="text-white/50">Opus 4.5 · relay MCP</p>
            <p className="text-white/50">~/Dev/acme-site</p>
          </div>
          <div className="border-l border-white/25 pl-3 leading-[1.3]">
            <p className="text-white/70">Tips for getting started</p>
            <p className="truncate text-white/50">Run /mcp to list tools…</p>
            <p className="my-1 border-t border-white/15" />
            <p className="text-white/70">Recent activity</p>
            <p className="text-white/50">No recent activity</p>
          </div>
        </div>
        <p className="landing-arrive mt-3 leading-[1.4] text-white/90">
          <span className="text-white/50">❯ </span>
          Find keywords where we rank 8 to 20 and fix the titles on those pages.
        </p>
        <div className="mt-3 space-y-[3px] leading-[1.35]">
          {SESSION.map(([kind, line], index) => (
            <p
              key={line}
              className={cn(
                "landing-arrive whitespace-pre-wrap",
                SESSION_STYLE[kind],
              )}
              style={{ animationDelay: `${600 + index * 260}ms` }}
            >
              {kind === "tool" || kind === "edit" ? (
                <span
                  className={kind === "edit" ? "text-white/50" : "text-white"}
                >
                  ●{" "}
                </span>
              ) : null}
              {line}
            </p>
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-black/90" />
    </div>
  );
}
