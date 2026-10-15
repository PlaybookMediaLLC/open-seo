import type { ReactNode } from "react";
import {
  IconBrandGoogle,
  IconBrain,
  IconChartBar,
  IconClipboardCheck,
  IconFileText,
  IconFlask,
  IconGitPullRequest,
  IconLink,
  IconTarget,
  IconWorld,
  type Icon,
} from "@tabler/icons-react";
import { cn } from "cn";
import { Eyebrow, Reveal, useAutoCycle } from "./LandingPrimitives";
import { LandingSeeAll } from "./LandingHero";

const SOURCES = [
  "Search Console",
  "Analytics 4",
  "DataForSEO",
  "Claude",
  "ChatGPT",
  "Perplexity",
  "Cursor",
  "Codex",
  "Cloudflare",
  "Stripe",
  "WordPress",
  "Webflow",
];

export function LandingLogos() {
  return (
    <section className="w-full px-4 pb-10 pt-24">
      <Reveal className="mx-auto max-w-[760px]">
        <div className="landing-marquee overflow-hidden">
          <div className="landing-marquee-track py-1">
            {[...SOURCES, ...SOURCES].map((name, i) => (
              <span
                key={i}
                className="mx-7 flex h-8 items-center whitespace-nowrap text-[17px] font-semibold tracking-[-0.4px] text-white/45"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
        <h2 className="mt-12 text-center text-[27px] font-semibold leading-[120%] tracking-[-1.24px] text-[#fafafa] sm:text-[31px]">
          Built for those who ship fast
        </h2>
        <p className="mt-2 text-center text-[16px] leading-[22.4px] text-[#888b91]">
          Your real Google data, live search research,
          <br />
          and{" "}
          <span className="text-[#fafafa]">the AI agents you already use</span>.
        </p>
        <p className="mt-4 text-center">
          <LandingSeeAll />
        </p>
      </Reveal>
    </section>
  );
}

const LENSES = [
  {
    name: "Pages",
    question: "/pricing gets 18k views but only 1% click",
    answer: "Rewrite the title and description to lift clicks by ~640 a month.",
  },
  {
    name: "Keywords",
    question: "Which keywords can we win this month?",
    answer:
      "“seo audit checklist”: 6.6k searches, difficulty 22, you rank #14.",
  },
  {
    name: "Links",
    question: "Who links to competitors but not us?",
    answer:
      "dev.to and indiehackers.com, 3 rival mentions each. Draft pitches?",
  },
  {
    name: "AI answers",
    question: "Does ChatGPT recommend us?",
    answer:
      "Not yet: it cites two rivals for “best seo tools”. Here’s the gap.",
  },
] as const;

export function LandingAdaptability() {
  const [active, pick] = useAutoCycle(LENSES.length, 3600);
  const lens = LENSES[active] ?? LENSES[0];
  const { question, answer } = lens;
  return (
    <section id="features" className="w-full px-4 pt-16">
      <div className="mx-auto max-w-[1024px]">
        <Reveal className="relative grid items-end md:grid-cols-2">
          <div className="relative flex h-full items-center py-10 md:pl-28">
            <div className="landing-dots pointer-events-none absolute inset-0" />
            <div className="relative">
              <Eyebrow color="#798498">Adaptability</Eyebrow>
              <h2 className="mt-2 w-[300px] text-[27px] font-semibold leading-[120%] tracking-[-1.24px] text-[#fafafa] sm:text-[31px]">
                SEO isn’t one-size-fits-all
              </h2>
            </div>
          </div>
          <div className="relative z-10 flex h-[400px] flex-col justify-between rounded-t-[32px] border border-b-0 border-[#0088ff]/20 bg-black p-8">
            <div
              key={lens.name}
              className="landing-reveal space-y-4"
              data-visible=""
            >
              <Bubble tilt="-rotate-2">{question}</Bubble>
              <div className="flex h-10 w-[120px] items-center gap-1.5 rounded-2xl bg-[#0b2a4a] px-4">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="h-1 w-5 rounded-full bg-[#5aa6ff]/60"
                  />
                ))}
              </div>
              <Bubble tilt="rotate-1">{answer}</Bubble>
            </div>
            <div className="flex justify-center gap-1">
              {LENSES.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => pick(index)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[14px] transition-colors",
                    index === active
                      ? "bg-[#0088ff]/20 text-[#3da2ff]"
                      : "text-white/70 hover:text-white",
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Bubble({ children, tilt }: { children: ReactNode; tilt: string }) {
  return (
    <div
      className={cn(
        "ml-auto w-fit max-w-[260px] rounded-[18px] bg-[#0a84ff] px-4 py-2.5 text-[15px] leading-snug text-white shadow-[0_8px_24px_-8px_rgb(10_132_255/0.6)]",
        tilt,
      )}
    >
      {children}
    </div>
  );
}

type Card = {
  title: string;
  body: string;
  emphasis: string;
  color: string;
  bg: string;
  icon: Icon;
  art: ReactNode;
};

const CARDS: Card[] = [
  {
    title: "Opportunity engine",
    body: "Search Console data turned into a ranked to-do list.",
    emphasis: "Highest-impact fixes first.",
    color: "#dd55e7",
    bg: "#1c031f",
    icon: IconTarget,
    art: <ScoreArt />,
  },
  {
    title: "Experiments",
    body: "Ship a change and measure it against a baseline.",
    emphasis: "Know what actually moved.",
    color: "#1cecbb",
    bg: "#031310",
    icon: IconFlask,
    art: <ChartArt color="#1cecbb" />,
  },
  {
    title: "Pull requests",
    body: "Approved metadata fixes open as PRs in your repo.",
    emphasis: "Review, merge, done.",
    color: "#ff5252",
    bg: "#200401",
    icon: IconGitPullRequest,
    art: <DiffArt />,
  },
  {
    title: "AI visibility",
    body: "See how ChatGPT, Claude and Perplexity answer about you.",
    emphasis: "Know who gets cited.",
    color: "#0088ff",
    bg: "#030719",
    icon: IconChartBar,
    art: <ChartArt color="#0088ff" bars />,
  },
  {
    title: "Search Console",
    body: "Queries, pages and positions, always in sync.",
    emphasis: "Read-only and private.",
    color: "#17c253",
    bg: "#02160b",
    icon: IconBrandGoogle,
    art: <ScoreArt label="Clicks" value="+38%" />,
  },
  {
    title: "Project context",
    body: "Goals, audience and competitors, set once.",
    emphasis: "Every answer follows them.",
    color: "#ffdd00",
    bg: "#191303",
    icon: IconBrain,
    art: <ScoreArt label="Context" value="4/4" />,
  },
];

export function LandingWhatsInside() {
  return (
    <section className="w-full px-4">
      <Reveal className="mx-auto max-w-[1024px] overflow-hidden rounded-b-[32px] rounded-tl-[32px] border border-[#0088ff]/20 bg-black pb-10 pt-8">
        <div className="px-6 sm:px-8">
          <Eyebrow color="#dd55e7">What’s inside</Eyebrow>
          <p className="mt-2 text-[20px] font-medium leading-[24px] tracking-[-0.6px] text-[#fafafa] sm:text-[24px]">
            Powerful features,
            <br />
            seamlessly integrated.
          </p>
        </div>
        <div className="landing-no-scrollbar mt-8 flex gap-8 overflow-x-auto px-6 pb-2 sm:px-8">
          {CARDS.map((card) => (
            <FeatureCard key={card.title} card={card} />
          ))}
        </div>
        <div className="mt-14 grid gap-10 px-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
          {SMALL_FEATURES.map(({ icon: Icon, title, body, badge }) => (
            <div key={title}>
              <Icon className="size-5 text-white" stroke={1.6} />
              <p className="mt-3 flex items-center gap-2 text-[16px] leading-[22.4px] text-[#fafafa]">
                {title}
                {badge ? (
                  <span className="rounded-full bg-[#ffdd00] px-1.5 text-[10px] font-semibold leading-4 text-black">
                    {badge}
                  </span>
                ) : null}
              </p>
              <p className="mt-2 max-w-[180px] text-[13px] leading-[20px] text-white/55">
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
      className="landing-card-border relative flex h-[400px] w-[300px] flex-none flex-col justify-end rounded-3xl p-6 sm:w-80"
      style={{ background: card.bg }}
    >
      <div className="absolute inset-x-0 top-0 h-64 overflow-hidden rounded-t-3xl">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background: `radial-gradient(120% 90% at 50% 0%, ${card.color}55, transparent 70%)`,
          }}
        />
        <div className="absolute inset-0 grid place-items-center">
          {card.art}
        </div>
      </div>
      <div className="relative mb-2 flex items-center">
        <span
          className="mr-2 grid size-6 shrink-0 place-items-center rounded-md"
          style={{ background: card.color }}
        >
          <Icon className="size-4 text-black/80" stroke={2} />
        </span>
        <h3
          className="text-[16px] font-medium leading-[140%] tracking-[0.16px]"
          style={{ color: card.color }}
        >
          {card.title}
        </h3>
      </div>
      <p className="relative text-sm leading-relaxed text-white/50">
        {card.body}
        <br />
        <span className="text-white">{card.emphasis}</span>
      </p>
    </div>
  );
}

function ScoreArt({
  label = "Priority",
  value = "92",
}: {
  label?: string;
  value?: string;
}) {
  return (
    <div className="rounded-[32px] bg-[#3a3a3c]/50 px-8 py-6 shadow-2xl backdrop-blur">
      <p className="text-[15px] text-white/60">{label}</p>
      <p className="text-[44px] font-semibold leading-none tracking-[-1.5px] text-white">
        {value}
      </p>
    </div>
  );
}

function ChartArt({ color, bars = false }: { color: string; bars?: boolean }) {
  const points = [30, 34, 31, 42, 40, 55, 52, 66, 70, 84];
  const path = points
    .map((h, i) => `${i === 0 ? "M" : "L"}${i * 22} ${100 - h}`)
    .join(" ");
  return (
    <div className="w-[230px] rounded-2xl bg-white/[0.06] p-4 backdrop-blur">
      {bars ? (
        <div className="flex h-24 items-end gap-1.5">
          {points.map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: `${h}%`,
                background: color,
                opacity: 0.4 + i * 0.06,
              }}
            />
          ))}
        </div>
      ) : (
        <svg viewBox="0 0 198 100" className="h-24 w-full" aria-hidden>
          <path d={`${path} L198 100 L0 100Z`} fill={color} opacity="0.15" />
          <path d={path} fill="none" stroke={color} strokeWidth="2.5" />
          <circle cx="198" cy="16" r="4" fill={color} />
        </svg>
      )}
    </div>
  );
}

function DiffArt() {
  return (
    <div className="w-[240px] rounded-2xl bg-black/40 p-3 font-mono text-[11px] leading-5 backdrop-blur">
      <p className="text-[#ff7b72]">- title: Pricing</p>
      <p className="text-[#3fb950]">+ title: Pricing · Plans from $0</p>
      <p className="text-[#ff7b72]">- description: (missing)</p>
      <p className="text-[#3fb950]">+ description: Rank tracking…</p>
    </div>
  );
}

const SMALL_FEATURES: {
  icon: Icon;
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
    body: "Referring domains, anchors, new and lost links.",
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
    body: "Client-ready reports you can share in one click.",
  },
];
