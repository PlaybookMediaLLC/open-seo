import type { CSSProperties } from "react";
import {
  IconArrowRight,
  IconBriefcase,
  IconPaperclip,
  IconPencil,
  IconRocket,
  IconTerminal2,
  type Icon,
} from "@tabler/icons-react";
import { cn } from "cn";
import { Reveal, useAutoCycle } from "./LandingPrimitives";

const AUDIENCES: {
  name: string;
  role: string;
  icon: Icon;
  tint: string;
  headline: string;
  body: string;
}[] = [
  {
    name: "Founders",
    role: "Ship SEO without hiring",
    icon: IconRocket,
    tint: "#ffb764",
    headline: "The weekly SEO meeting, in one screen",
    body: "Connect Search Console and Relay ranks this week’s opportunities by impact. Approve the top three and get back to building.",
  },
  {
    name: "Agencies",
    role: "One workspace per client",
    icon: IconBriefcase,
    tint: "#7fb2ff",
    headline: "Every client, one login",
    body: "Projects, rank tracking and shareable reports for each client, billed at data cost instead of per seat.",
  },
  {
    name: "Developers",
    role: "SEO from the terminal",
    icon: IconTerminal2,
    tint: "#1cecbb",
    headline: "Your agent does the research",
    body: "Point Claude Code or Cursor at the Relay MCP server. It audits, researches keywords and opens the pull request.",
  },
  {
    name: "Content teams",
    role: "Write what will rank",
    icon: IconPencil,
    tint: "#dd55e7",
    headline: "Briefs backed by real data",
    body: "Keyword clusters, SERP checks and AI-answer tracking in one place, tied to the pages you already have.",
  },
];

/** Where each folder sits in the stack, front first (measured on superwhisper). */
const STACK = [
  { transform: "rotate(-2deg)", sheet: 0.6 },
  { transform: "translate(8px, 16px) rotate(-1deg)", sheet: 0.4 },
  { transform: "translate(16px, 24px)", sheet: 0.3 },
  { transform: "translate(-8px, 32px) rotate(2deg)", sheet: 0.25 },
];

export function LandingAudiences() {
  const [active, pick] = useAutoCycle(AUDIENCES.length, 6000);
  return (
    <section className="landing-testimonials relative w-full overflow-hidden py-24 md:h-[900px] md:py-0">
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-4">
        <Reveal className="flex flex-col items-center">
          <p className="text-sm font-medium leading-5 tracking-wide text-[#ff9dc4]">
            Who it’s for
          </p>
          <h2 className="mb-[76px] mt-4 text-center text-[36px] font-semibold leading-[107%] tracking-[-1.8px] text-[#e9feff] md:mb-24 md:text-[48px]">
            Made for builders,
            <br />
            built for how you work
          </h2>
        </Reveal>
        <Reveal delay={120} className="flex">
          <button
            type="button"
            aria-label="Show the next use case"
            onClick={() => pick((active + 1) % AUDIENCES.length)}
            className="relative h-[410px] w-[320px] cursor-pointer text-left md:h-96 md:w-[534px] md:cursor-default"
          >
            {AUDIENCES.map((audience, index) => {
              const depth =
                (index - active + AUDIENCES.length) % AUDIENCES.length;
              const place = STACK[depth] ?? STACK[0];
              return (
                <Folder
                  key={audience.name}
                  audience={audience}
                  front={depth === 0}
                  sheet={place.sheet}
                  style={{
                    zIndex: 50 - depth * 10,
                    transform: place.transform,
                  }}
                />
              );
            })}
          </button>
          <div className="ml-16 mt-16 hidden md:block">
            <p className="text-xl font-medium text-[#fafafa]">Use cases</p>
            <p className="mb-4 text-xs text-[#c4c5c9]">Pick yours</p>
            <div className="flex flex-col gap-y-2">
              {AUDIENCES.map((audience, index) => (
                <button
                  key={audience.name}
                  type="button"
                  aria-pressed={index === active}
                  onClick={() => pick(index)}
                  className={cn(
                    "flex w-full items-center rounded-[10px] py-3 pl-2 pr-6 text-left transition-colors hover:bg-white/15",
                    index === active && "bg-white/15",
                  )}
                >
                  <span
                    className={cn(
                      "mb-2 mr-1.5 size-[10px] rounded-full bg-[#0088ff]",
                      index === active && "opacity-0",
                    )}
                  />
                  <Avatar audience={audience} className="mr-3 size-8" />
                  <span>
                    <span className="block text-sm font-medium text-[#fafafa]">
                      {audience.name}
                    </span>
                    <span className="block text-xs text-[#888b91]">
                      {audience.role}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Avatar({
  audience,
  className,
}: {
  audience: (typeof AUDIENCES)[number];
  className?: string;
}) {
  const Icon = audience.icon;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full ring-2 ring-inset ring-white/20",
        className,
      )}
      style={{ background: audience.tint }}
    >
      <Icon className="size-1/2 text-black/75" stroke={1.8} />
    </span>
  );
}

/** One glass folder: a header, then the use case on a clipped white card. */
function Folder({
  audience,
  front,
  sheet,
  style,
}: {
  audience: (typeof AUDIENCES)[number];
  front: boolean;
  sheet: number;
  style: CSSProperties;
}) {
  return (
    <span
      aria-hidden={!front}
      className="landing-folder absolute inset-0 block rounded-lg"
      style={style}
    >
      <span
        className="absolute inset-0 rounded-lg"
        style={{ background: `rgb(255 255 255 / ${sheet})` }}
      />
      <span className="landing-noise absolute inset-0 rounded-lg opacity-30" />
      <span className="landing-folder-sheen absolute inset-0 rounded-lg opacity-60" />
      <span className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/25" />
      <span
        className={cn(
          "relative flex flex-col px-6 py-4 transition-opacity duration-300",
          !front && "opacity-0",
        )}
      >
        <span className="flex">
          <Avatar audience={audience} className="size-10" />
          <span className="ml-[10px] flex flex-col">
            <span className="text-lg font-medium leading-6 text-black [text-shadow:0_1px_2px_rgb(255_255_255/0.5),0_-1px_2px_rgb(0_0_0/0.1)]">
              {audience.name}
            </span>
            <span className="text-sm font-semibold text-[#333]">
              {audience.role}
            </span>
          </span>
        </span>
        <span className="mt-4 h-px w-full bg-black/10" />
        <span className="relative mt-4 block w-[288px] -rotate-2 rounded-3xl bg-white p-6 shadow-[0_1px_4px_rgb(0_0_0/0.25),0_4px_59px_rgb(0_0_0/0.1)] md:w-[509px]">
          <span className="block text-[16px] font-semibold leading-5 text-black">
            {audience.headline}
          </span>
          <span className="mt-4 block text-[14px] leading-[21px] tracking-[-0.2px] text-[#3c3c3b]">
            {audience.body}
          </span>
          <span className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-[#0088ff]">
            <IconArrowRight className="size-3.5" /> Try it on the Free plan
          </span>
          <IconPaperclip
            aria-hidden
            className="absolute -right-6 top-4 size-[64px] rotate-12 text-[#a7a9ae]"
            stroke={1.2}
          />
        </span>
      </span>
    </span>
  );
}
