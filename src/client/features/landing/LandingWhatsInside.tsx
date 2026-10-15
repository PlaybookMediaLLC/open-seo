import type { ReactNode } from "react";
import {
  IconChartLine,
  IconClipboardCheck,
  IconFileText,
  IconFlask,
  IconLink,
  IconListDetails,
  IconMessageCircleSearch,
  IconSearch,
  IconTarget,
  IconWorld,
  type Icon,
} from "@tabler/icons-react";
import {
  ConsoleArt,
  ExperimentArt,
  KeywordArt,
  OpportunityArt,
  RankArt,
  ReportArt,
} from "./LandingFeatureArt";
import { Eyebrow, Reveal } from "./LandingPrimitives";

type Card = {
  title: string;
  body: string;
  emphasis: string;
  icon: Icon;
  art: ReactNode;
};

const CARDS: Card[] = [
  {
    title: "Opportunity engine",
    body: "Search Console data turned into a ranked to-do list.",
    emphasis: "Highest-impact fixes first.",
    icon: IconTarget,
    art: <OpportunityArt />,
  },
  {
    title: "Rank tracking",
    body: "Weekly positions for every keyword that matters.",
    emphasis: "See the trend, not a snapshot.",
    icon: IconChartLine,
    art: <RankArt />,
  },
  {
    title: "Keyword research",
    body: "Volume, difficulty, CPC and intent for every idea.",
    emphasis: "Save the ones worth writing.",
    icon: IconSearch,
    art: <KeywordArt />,
  },
  {
    title: "Experiments",
    body: "Ship a change and measure it against a baseline.",
    emphasis: "Know what actually moved.",
    icon: IconFlask,
    art: <ExperimentArt />,
  },
  {
    title: "Search Console",
    body: "Queries, pages and clicks, synced every day.",
    emphasis: "Read-only and private.",
    icon: IconListDetails,
    art: <ConsoleArt />,
  },
  {
    title: "Client reports",
    body: "Turn the numbers into a page a client can read.",
    emphasis: "Share it with one link.",
    icon: IconFileText,
    art: <ReportArt />,
  },
];

export function LandingWhatsInside() {
  return (
    <section className="relative w-full">
      <Reveal className="relative z-10 mx-auto w-full max-w-[1024px] bg-black">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-(--l-line-strong) sm:left-12" />
        <div className="pointer-events-none absolute bottom-0 left-0 top-12 hidden w-px bg-linear-to-b from-(--l-line-strong) to-transparent sm:block" />
        <div className="pointer-events-none absolute bottom-0 right-0 top-px hidden w-px bg-linear-to-b from-(--l-line-strong) to-transparent sm:block" />
        <div className="pointer-events-none absolute left-0 top-0 hidden size-12 rounded-tl-[32px] border-l border-t border-(--l-line-strong) sm:block" />
        <div className="px-6 pt-9 sm:pl-9">
          <Eyebrow>What’s inside</Eyebrow>
          <p className="mt-2 text-[18px] font-medium tracking-tight text-(--l-text) sm:text-[24px]">
            Powerful features,
            <br />
            seamlessly integrated.
          </p>
        </div>
        <div className="relative z-20 translate-y-12">
          <div className="h-[402px]" />
          {/* Full-bleed rail: cards start on the column and run off-screen. */}
          <div className="absolute left-1/2 top-0 w-screen -translate-x-1/2">
            <div className="landing-no-scrollbar landing-rail snap-x snap-mandatory overflow-x-auto">
              <div className="flex w-max gap-8 py-px">
                {CARDS.map((card) => (
                  <FeatureCard key={card.title} card={card} />
                ))}
              </div>
            </div>
            <div className="landing-blur-right pointer-events-none absolute right-0 top-0 hidden h-[402px] w-56 bg-gradient-to-l from-black to-transparent md:block" />
          </div>
        </div>
      </Reveal>
      <Reveal className="mx-auto mt-32 grid w-full max-w-[370px] grid-cols-1 gap-10 px-9 md:max-w-[828px] md:grid-cols-2 lg:max-w-[1024px] lg:grid-cols-4 lg:gap-20">
        {SMALL_FEATURES.map(({ icon: Icon, title, body, badge }) => (
          <div key={title} className="flex gap-3 md:block">
            <Icon
              className="mb-0 size-6 shrink-0 text-(--l-text) md:mb-3"
              stroke={1.5}
            />
            <div>
              <p className="mb-[9px] flex items-center text-[16px] leading-[22.4px] tracking-[0.16px] text-(--l-text)">
                {title}
                {badge ? (
                  <span className="ml-2 rounded-full bg-(--l-text) px-2 text-[10px] font-bold leading-4 text-black">
                    {badge}
                  </span>
                ) : null}
              </p>
              <p className="text-[12px] leading-[19.2px] tracking-[0.12px] text-(--l-text-2) md:h-[38px]">
                {body}
              </p>
            </div>
          </div>
        ))}
      </Reveal>
    </section>
  );
}

function FeatureCard({ card }: { card: Card }) {
  const Icon = card.icon;
  return (
    <div className="landing-card-border relative flex h-[400px] w-[300px] flex-none snap-start flex-col justify-end overflow-hidden rounded-3xl bg-(--l-surface) p-6 sm:w-80">
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(90%_75%_at_25%_0%,rgb(255_255_255/0.12),transparent_70%),radial-gradient(70%_70%_at_100%_35%,rgb(255_255_255/0.05),transparent_70%)]" />
      <div className="landing-noise absolute inset-x-0 top-0 h-64 opacity-30" />
      <div className="absolute inset-x-0 top-0 grid h-64 place-items-center">
        {card.art}
      </div>
      <div className="relative mb-2 flex items-center">
        <span className="mr-2 grid size-6 shrink-0 place-items-center rounded-md bg-(--l-text)">
          <Icon className="size-4 text-black/80" stroke={2} />
        </span>
        <h3 className="text-[16px] font-medium leading-[140%] tracking-[0.16px] text-(--l-text)">
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
    icon: IconMessageCircleSearch,
    title: "AI visibility",
    body: "See how ChatGPT and Perplexity answer for your topics.",
  },
];
