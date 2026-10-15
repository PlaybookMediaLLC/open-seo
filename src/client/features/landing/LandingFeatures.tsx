import { useState, type ComponentType } from "react";
import {
  IconAdjustmentsHorizontal,
  IconBrain,
  IconChartLine,
  IconClipboardCheck,
  IconCpu,
  IconFileText,
  IconFlask,
  IconGitPullRequest,
  IconLink,
  IconRepeat,
  IconSparkles,
  IconTarget,
  IconWorld,
} from "@tabler/icons-react";
import { cn } from "cn";
import { Eyebrow, Reveal, SectionTitle } from "./LandingPrimitives";

const LENSES = {
  Opportunities: [
    ["/pricing", "CTR 1.1% at position 4", "Rewrite title"],
    ["/blog/seo-audit", "Rising query, no H2", "Add section"],
    ["/features", "Cannibalizing /home", "Consolidate"],
  ],
  Keywords: [
    ["seo audit checklist", "6.6k · KD 22", "Target"],
    ["free rank tracker", "2.9k · KD 31", "Target"],
    ["open source seo tool", "1.3k · KD 18", "Target"],
  ],
  Backlinks: [
    ["indiehackers.com", "DR 82 · links to rivals", "Pitch"],
    ["dev.to", "DR 91 · 3 rival mentions", "Pitch"],
    ["producthunt.com", "DR 90 · listing gap", "Submit"],
  ],
  "AI answers": [
    ["best seo tools 2026", "ChatGPT cites 2 rivals", "Get cited"],
    ["semrush alternative", "Perplexity cites you", "Defend"],
    ["track ai visibility", "Claude cites nobody", "Get cited"],
  ],
} as const;

type Lens = keyof typeof LENSES;

const LENS_NAMES = Object.keys(LENSES).filter(
  (name): name is Lens => name in LENSES,
);

export function LandingAdaptability() {
  const [lens, setLens] = useState<Lens>("Opportunities");
  return (
    <section id="features" className="px-4 py-16">
      <Reveal className="mx-auto grid max-w-[880px] items-center gap-10 md:grid-cols-[1fr_1.15fr]">
        <div className="relative">
          <div className="landing-dots pointer-events-none absolute -inset-10" />
          <p className="relative text-sm font-medium text-[#798498]">
            One workspace
          </p>
          <SectionTitle className="relative mt-2 max-w-[320px]">
            SEO isn’t one-size-fits-all
          </SectionTitle>
          <p className="relative mt-3 max-w-[320px] text-sm leading-relaxed text-white/50">
            Switch lenses on the same site. Every view ends in a concrete next
            step, not another chart.
          </p>
        </div>
        <div className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-[#0d1220] to-black p-5">
          <div className="space-y-2.5">
            {LENSES[lens].map(([subject, signal, action], index) => (
              <div
                key={`${lens}-${subject}`}
                className="landing-reveal flex items-center gap-3 rounded-2xl bg-[#2f7cf6] px-4 py-3 text-white shadow-[0_8px_24px_-12px_rgb(47_124_246/0.8)] data-[visible]:opacity-100"
                data-visible=""
                style={{
                  marginLeft: index === 1 ? 0 : "auto",
                  width: "92%",
                  background: index === 1 ? "#1c2333" : undefined,
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {subject}
                  </span>
                  <span className="block truncate text-xs text-white/70">
                    {signal}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px]">
                  {action}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-1">
            {LENS_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setLens(name)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition-colors",
                  lens === name
                    ? "bg-[#2f7cf6]/25 text-[#9cc0ff]"
                    : "text-white/60 hover:text-white",
                )}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

type Card = {
  title: string;
  body: string;
  emphasis: string;
  color: string;
  glow: string;
  icon: ComponentType<{ className?: string }>;
};

const CARDS: Card[] = [
  {
    title: "Opportunity engine",
    body: "Search Console data turned into a ranked to-do list.",
    emphasis: "Highest-impact fixes first.",
    color: "#b46cff",
    glow: "from-[#3a1d5c] to-[#12081f]",
    icon: IconTarget,
  },
  {
    title: "Experiments",
    body: "Ship a change, then measure it against a baseline.",
    emphasis: "Know what actually moved.",
    color: "#1cecbb",
    glow: "from-[#0c3b33] to-[#04130f]",
    icon: IconFlask,
  },
  {
    title: "Pull requests",
    body: "Approved metadata fixes open as PRs in your repo.",
    emphasis: "Review, merge, done.",
    color: "#ff5252",
    glow: "from-[#4a1414] to-[#160505]",
    icon: IconGitPullRequest,
  },
  {
    title: "AI visibility",
    body: "Track how ChatGPT, Claude and Perplexity answer about you.",
    emphasis: "See who gets cited.",
    color: "#0088ff",
    glow: "from-[#0b2a52] to-[#040c18]",
    icon: IconChartLine,
  },
];

export function LandingWhatsInside() {
  return (
    <section className="px-4 py-16">
      <Reveal className="mx-auto max-w-[880px] rounded-[28px] border border-white/[0.07] bg-[#050507] p-6 sm:p-8">
        <Eyebrow className="text-[#d36be0]">What’s inside</Eyebrow>
        <p className="mt-2 text-[20px] font-medium tracking-tight text-[#e5e5e5] sm:text-[24px]">
          Powerful features,
          <br />
          seamlessly integrated.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((card, index) => (
            <Reveal key={card.title} delay={index * 90}>
              <FeatureCard card={card} />
            </Reveal>
          ))}
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {SMALL_FEATURES.map(({ icon: Icon, title, body, badge }) => (
            <div key={title}>
              <Icon className="size-5 text-white/80" />
              <p className="mt-3 flex items-center gap-2 text-[15px] text-white">
                {title}
                {badge ? (
                  <span className="rounded-full bg-[#e8ff47] px-1.5 py-px text-[10px] font-semibold text-black">
                    {badge}
                  </span>
                ) : null}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/45">
                {body}
              </p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function FeatureCard({ card }: { card: Card }) {
  const Icon = card.icon;
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-3xl bg-gradient-to-b",
        card.glow,
      )}
    >
      <div className="relative grid h-36 place-items-center">
        <span
          className="absolute size-24 rounded-full opacity-40 blur-2xl"
          style={{ background: card.color }}
        />
        <span className="relative grid size-14 place-items-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur">
          <Icon className="size-7 text-white" />
        </span>
      </div>
      <div className="flex-1 p-5 pt-2">
        <h3
          className="flex items-center gap-2 text-base font-medium leading-[140%]"
          style={{ color: card.color }}
        >
          {card.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/50">
          {card.body} <span className="text-white">{card.emphasis}</span>
        </p>
      </div>
    </div>
  );
}

const SMALL_FEATURES: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  badge?: string;
}[] = [
  {
    icon: IconWorld,
    title: "Domain overview",
    body: "Traffic, keywords and competitors for any domain.",
  },
  {
    icon: IconLink,
    title: "Backlinks",
    body: "Referring domains, anchors and new or lost links.",
  },
  {
    icon: IconClipboardCheck,
    title: "Site audit",
    body: "Crawl issues and Lighthouse scores, prioritized.",
    badge: "New",
  },
  {
    icon: IconFileText,
    title: "Reports",
    body: "Shareable client-ready reports in one click.",
  },
];

export function LandingBuildIt() {
  return (
    <section className="px-4 py-24">
      <Reveal className="mx-auto grid max-w-[960px] items-center gap-12 md:grid-cols-2">
        <ContextMock />
        <div>
          <Eyebrow>Project context</Eyebrow>
          <h2 className="mt-3 text-[40px] font-semibold leading-[1.05] tracking-[-1.6px] text-white sm:text-[52px]">
            Tune it yourself
          </h2>
          <p className="mt-3 max-w-[380px] text-sm leading-relaxed text-white/50">
            Tell OpenSEO who you are, who you compete with and what matters.
            Every recommendation follows. Down to the finest detail.
          </p>
          <div className="mt-8 space-y-7">
            {BUILD_POINTS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <Icon className="mt-0.5 size-5 shrink-0 text-[#3d8bff]" />
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
      </Reveal>
    </section>
  );
}

const BUILD_POINTS = [
  {
    icon: IconAdjustmentsHorizontal,
    title: "Beyond keywords: positioning",
    body: "Set goals, audiences and competitors once. Research and reports adapt to them.",
  },
  {
    icon: IconCpu,
    title: "Pick the right model for the job",
    body: "Bring Claude, GPT or Gemini through your own agent, or use the built-in assistant.",
  },
  {
    icon: IconRepeat,
    title: "Consistent every week",
    body: "Saved keywords, tracked ranks and recurring audits keep the signal steady.",
  },
];

function ContextMock() {
  const rows = [
    ["Site", "playbookmedia.io"],
    ["Goal", "Grow demo signups"],
    ["Audience", "B2B marketing leads"],
    ["Competitors", "semrush.com, ahrefs.com"],
  ];
  return (
    <div className="relative mx-auto w-full max-w-[420px] [perspective:1200px]">
      <div className="rotate-x-[8deg] -rotate-y-[14deg] rounded-2xl border border-white/10 bg-[#121317]/90 p-4 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)] [transform-style:preserve-3d]">
        <div className="flex items-center gap-2 border-b border-white/5 pb-3 text-xs text-white/60">
          <IconBrain className="size-4" /> Context
        </div>
        <div className="mt-3 space-y-2">
          {rows.map(([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-xs"
            >
              <span className="text-white/45">{key}</span>
              <span className="text-white">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-white/10 bg-black/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Assistant
          </p>
          {["Claude Sonnet", "GPT-5", "Gemini 3 Flash"].map((model, index) => (
            <p
              key={model}
              className={cn(
                "mt-1.5 flex items-center gap-2 rounded-md px-2 py-1 text-xs",
                index === 0 ? "bg-white/10 text-white" : "text-white/55",
              )}
            >
              <IconSparkles className="size-3" /> {model}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
