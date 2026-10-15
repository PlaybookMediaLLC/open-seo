import type { ReactNode } from "react";
import {
  IconBrandGoogle,
  IconBrandOpenai,
  IconBrandStripe,
  IconBrandVercel,
  IconBrandVscode,
  IconBrandWebflow,
  IconBrandWordpress,
  IconBrain,
  IconChartBar,
  IconCloud,
  IconMessageChatbot,
  IconShoppingBag,
  IconClipboardCheck,
  IconFileText,
  IconFlask,
  IconLink,
  IconSearch,
  IconTarget,
  IconTerminal2,
  IconWorld,
  type Icon,
} from "@tabler/icons-react";
import { cn } from "cn";
import { Eyebrow, Reveal, useAutoCycle } from "./LandingPrimitives";
import { ShotCrop } from "./AppWindow";

const LOGOS: { name: string; icon: Icon }[] = [
  { name: "Search Console", icon: IconBrandGoogle },
  { name: "Analytics 4", icon: IconChartBar },
  { name: "Claude", icon: IconMessageChatbot },
  { name: "OpenAI", icon: IconBrandOpenai },
  { name: "Cursor", icon: IconBrandVscode },
  { name: "Codex", icon: IconTerminal2 },
  { name: "WordPress", icon: IconBrandWordpress },
  { name: "Webflow", icon: IconBrandWebflow },
  { name: "Vercel", icon: IconBrandVercel },
  { name: "Cloudflare", icon: IconCloud },
  { name: "Shopify", icon: IconShoppingBag },
  { name: "Stripe", icon: IconBrandStripe },
];

export function LandingLogos() {
  return (
    <section className="w-full px-4 pb-6 pt-28">
      <Reveal className="mx-auto max-w-[1024px]">
        {[false, true].map((reverse) => (
          <div
            key={String(reverse)}
            className="landing-marquee overflow-hidden"
          >
            <div
              className="landing-marquee-track"
              data-reverse={reverse ? "" : undefined}
            >
              {[...LOGOS, ...LOGOS].map(({ name, icon: Icon }, index) => (
                <span
                  key={`${name}-${index}`}
                  className="mx-5 flex h-11 shrink-0 items-center gap-2 text-white/25 transition-colors hover:text-white/50"
                >
                  <Icon className="size-[18px]" stroke={1.6} />
                  <span className="whitespace-nowrap text-[14px] font-medium tracking-[-0.2px]">
                    {name}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
        <h2 className="mt-12 text-center text-[27px] font-semibold leading-[120%] tracking-[-1.24px] text-[#fafafa] sm:text-[31px]">
          Built for those who move fast
        </h2>
        <p className="mt-3 text-center text-[16px] leading-[22.4px] text-[#888b91]">
          Your Google data, live search research and
          <br />
          the <span className="text-[#fafafa]">AI agents you already use</span>.
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
              <h2 className="mt-2 max-w-[320px] text-[27px] font-semibold leading-[120%] tracking-[-1.24px] text-[#fafafa] sm:text-[31px]">
                SEO isn’t one-size-fits-all
              </h2>
            </div>
          </div>
          <div className="relative z-10 flex h-[340px] flex-col rounded-t-[32px] border border-b-0 border-[#0088ff]/20 bg-black p-8">
            <div
              key={lens.name}
              className="landing-reveal flex flex-1 flex-col justify-center gap-3"
              data-visible=""
            >
              <Bubble tilt="-rotate-2">{question}</Bubble>
              <div className="flex h-9 w-[104px] items-center gap-1.5 rounded-2xl bg-[#0b2a4a] px-4">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="h-1 w-4 rounded-full bg-[#5aa6ff]/60"
                  />
                ))}
              </div>
              <Bubble tilt="rotate-1">{answer}</Bubble>
            </div>
            <div className="mt-5 flex justify-center gap-1">
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
  /** Which screenshot to crop, and the region of it to show. */
  shot: Parameters<typeof ShotCrop>[0]["shot"];
  focus: string;
  scale?: number;
};

const CARDS: Card[] = [
  {
    title: "Opportunity engine",
    body: "Search Console data turned into a ranked to-do list.",
    emphasis: "Highest-impact fixes first.",
    color: "#dd55e7",
    bg: "#1c031f",
    icon: IconTarget,
    shot: "opportunities",
    focus: "22% 78%",
    scale: 2.1,
  },
  {
    title: "Rank tracking",
    body: "Weekly positions for every keyword that matters.",
    emphasis: "See the trend, not a snapshot.",
    color: "#1cecbb",
    bg: "#031310",
    icon: IconChartBar,
    shot: "rankTracking",
    focus: "60% 36%",
    scale: 1.9,
  },
  {
    title: "Keyword research",
    body: "Volume, difficulty, CPC and intent for every idea.",
    emphasis: "Save the ones worth writing.",
    color: "#0088ff",
    bg: "#030719",
    icon: IconSearch,
    shot: "savedKeywords",
    focus: "55% 40%",
    scale: 2,
  },
  {
    title: "Experiments",
    body: "Ship a change and measure it against a baseline.",
    emphasis: "Know what actually moved.",
    color: "#ff5252",
    bg: "#200401",
    icon: IconFlask,
    shot: "opportunities",
    focus: "78% 62%",
    scale: 2.4,
  },
  {
    title: "Search Console",
    body: "Queries, pages and positions, always in sync.",
    emphasis: "Read-only and private.",
    color: "#17c253",
    bg: "#02160b",
    icon: IconBrandGoogle,
    shot: "opportunities",
    focus: "50% 22%",
    scale: 2.2,
  },
  {
    title: "Project context",
    body: "Goals, audience and competitors, set once.",
    emphasis: "Every answer follows them.",
    color: "#ffdd00",
    bg: "#191303",
    icon: IconBrain,
    shot: "rankTracking",
    focus: "20% 20%",
    scale: 2.2,
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
        <div className="relative">
          {/* Scrolls horizontally, with a fade at the right edge so a card
              reads as continuing rather than being sliced by the container. */}
          <div className="landing-rail landing-no-scrollbar mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-2 sm:px-8">
            {CARDS.map((card) => (
              <FeatureCard key={card.title} card={card} />
            ))}
            <span aria-hidden className="w-2 flex-none" />
          </div>
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
      className="landing-card-border relative flex h-[400px] w-[300px] flex-none snap-start flex-col justify-end rounded-3xl p-6 sm:w-80"
      style={{ background: card.bg }}
    >
      <div className="absolute inset-x-0 top-0 h-64 overflow-hidden rounded-t-3xl">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 80% at 50% -10%, ${card.color}2e, transparent 65%)`,
          }}
        />
        <div className="absolute inset-0 grid place-items-center">
          <ShotCrop
            shot={card.shot}
            width={250}
            aspect={0.62}
            focus={card.focus}
            scale={card.scale}
          />
        </div>
        <div
          className="absolute inset-x-0 bottom-0 h-16"
          style={{
            background: `linear-gradient(to bottom, transparent, ${card.bg})`,
          }}
        />
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
