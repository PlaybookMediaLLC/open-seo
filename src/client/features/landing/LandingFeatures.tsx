import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";
import { Eyebrow, Logo, Reveal, useAutoCycle } from "./LandingPrimitives";

const LOGOS = [
  ["googlesearchconsole", "Search Console"],
  ["googleanalytics", "Analytics"],
  ["claude", "Claude"],
  ["openai", "ChatGPT"],
  ["cursor", "Cursor"],
  ["perplexity", "Perplexity"],
  ["googlegemini", "Gemini"],
  ["github", "GitHub"],
  ["wordpress", "WordPress"],
  ["webflow", "Webflow"],
  ["shopify", "Shopify"],
  ["wix", "Wix"],
  ["squarespace", "Squarespace"],
  ["ghost", "Ghost"],
  ["framer", "Framer"],
  ["nextdotjs", "Next.js"],
  ["vercel", "Vercel"],
  ["netlify", "Netlify"],
  ["cloudflare", "Cloudflare"],
  ["notion", "Notion"],
] as const;

export function LandingLogos() {
  return (
    <section className="relative mb-24 mt-8 flex w-full flex-col items-center overflow-hidden">
      <div
        aria-hidden
        className="landing-dots pointer-events-none absolute h-[350px] w-[550px] max-w-full [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_0%,#000_40%,transparent_90%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute h-[700px] w-[1100px] bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgb(255_255_255/0.06)_0%,transparent_70%)]"
      />
      <Reveal className="relative z-10 flex w-full flex-col items-center">
        <div className="landing-marquee mb-8 w-full">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              aria-hidden={copy === 1}
              className="landing-marquee-track"
            >
              {LOGOS.map(([slug, name]) => (
                <span
                  key={slug}
                  className="flex h-8 items-center justify-center gap-2 text-(--l-text-2)"
                >
                  <Logo slug={slug} className="size-[18px]" />
                  <span className="whitespace-nowrap text-[17px] font-semibold tracking-[-0.5px]">
                    {name}
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
        <div className="px-8 md:px-0">
          <h2 className="text-center text-[27px] font-semibold leading-[120%] tracking-[-1.24px] text-(--l-text) sm:text-[31px]">
            Built for those who move fast
          </h2>
          <p className="mt-3 text-center text-[14px] font-medium leading-[160%] tracking-[0.14px] text-(--l-text-2)">
            Your Google data, live search research
            <br />
            and{" "}
            <span className="text-(--l-text)">
              the AI agents you already use
            </span>
            , in one place.
          </p>
          <p className="mt-4 text-center">
            <a
              href="#integrations"
              className="text-[14px] font-medium tracking-[0.14px] text-(--l-text-2) underline decoration-white/25 underline-offset-4 transition-colors hover:text-(--l-text) hover:decoration-white/60"
            >
              See every integration
            </a>
          </p>
        </div>
      </Reveal>
    </section>
  );
}

/** Each lens is one question, the work in between, and the answer. */
const LENSES = [
  {
    name: "Pages",
    question: "/pricing gets 18k views but only 1% click. Why?",
    work: "Checking titles, snippets and the top ten results",
    answer:
      "The title hides the price. Rewrite it and the description to win about 640 more clicks a month.",
  },
  {
    name: "Keywords",
    question: "Which keywords can we win this month?",
    work: "Comparing volume, difficulty and current rank",
    answer:
      "“seo audit checklist”: 6.6k searches a month, difficulty 22, and you already rank #14.",
  },
  {
    name: "Links",
    question: "Who links to our competitors but not to us?",
    work: "Diffing referring domains across three rivals",
    answer:
      "dev.to and indiehackers.com mention two rivals each. Want a pitch draft for both?",
  },
  {
    name: "AI answers",
    question: "Does ChatGPT recommend us?",
    work: "Asking ChatGPT, Perplexity and Gemini",
    answer:
      "Not yet. It cites two rivals for “best seo tools”. Here is what their pages have that yours lacks.",
  },
] as const;

export function LandingAdaptability() {
  const [active, pick] = useAutoCycle(LENSES.length, 4500);
  const lens = LENSES[active] ?? LENSES[0];
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const tab = tabs.current[active];
    if (tab) setPill({ left: tab.offsetLeft, width: tab.offsetWidth });
  }, [active]);

  return (
    <section
      id="features"
      className="flex w-full flex-col items-center md:items-end md:justify-end"
    >
      <Reveal className="mx-auto flex w-full max-w-[1024px] flex-col sm:mt-24 md:h-[400px] md:flex-row md:items-end md:justify-center">
        <div className="relative md:w-[524px]">
          <div
            aria-hidden
            className="landing-dots pointer-events-none absolute -bottom-6 -right-6 hidden h-[420px] w-[560px] [mask-image:radial-gradient(circle_at_100%_100%,#000_0%,#000_35%,transparent_75%)] md:block"
          />
          <div className="relative z-20 mb-12 ml-6 md:mb-36 md:ml-12">
            <div className="flex h-[140px] w-full flex-col justify-end sm:h-[260px] md:w-[400px]">
              <Eyebrow>Adaptability</Eyebrow>
              <h2 className="mt-2 w-[300px] text-[27px] font-semibold leading-[120%] tracking-[-1.24px] text-(--l-text) sm:text-[31px]">
                SEO isn’t
                <br />
                one-size-fits-all
              </h2>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex h-[400px] w-full flex-col items-center overflow-hidden rounded-t-[32px] border-x border-t border-(--l-line-strong) bg-black px-6 sm:px-10 md:w-[500px]">
          <div key={lens.name} className="flex h-[300px] w-full items-center">
            <div className="w-full">
              <Bubble side="you" tilt="-rotate-1" delay={0}>
                {lens.question}
              </Bubble>
              <Bubble side="work" delay={140}>
                <Redacted text={lens.work} />
              </Bubble>
              <Bubble side="you" tilt="rotate-2" delay={280}>
                {lens.answer}
              </Bubble>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-black via-black/95 to-transparent" />
          <div className="relative z-30 mb-6 mt-auto flex items-center gap-x-1 sm:gap-x-4">
            <span
              aria-hidden
              className="absolute h-8 rounded-full bg-white/10 transition-all duration-300"
              style={{ left: pill.left, width: pill.width }}
            />
            {LENSES.map((item, index) => (
              <button
                key={item.name}
                ref={(node) => {
                  tabs.current[index] = node;
                }}
                type="button"
                aria-pressed={index === active}
                onClick={() => pick(index)}
                className={cn(
                  "relative z-10 select-none whitespace-nowrap px-4 py-1 text-sm transition-colors duration-200",
                  index === active
                    ? "text-(--l-text)"
                    : "text-(--l-text-2) hover:text-(--l-text)",
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Bubble({
  side,
  tilt,
  delay,
  children,
}: {
  side: "you" | "work";
  tilt?: string;
  delay: number;
  children: ReactNode;
}) {
  const you = side === "you";
  return (
    <div
      className={cn("landing-arrive mb-4 flex", you ? "justify-end" : "")}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={cn(
          "max-w-80 px-6 py-4 text-[15px] leading-snug",
          you
            ? "rounded-t-[24px] rounded-bl-[24px] rounded-br-[10px] bg-(--l-text) text-black"
            : "rounded-t-[24px] rounded-bl-[10px] rounded-br-[24px] bg-white/10 text-white/60",
          tilt,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Words drawn as rounded blobs, superwhisper's "Flow" redaction look. */
function Redacted({ text }: { text: string }) {
  return (
    <span className="flex flex-wrap gap-x-1.5 gap-y-2 py-1 opacity-60">
      <span className="sr-only">{text}</span>
      {text.split(" ").map((word, index) => (
        <span
          key={`${word}-${index}`}
          aria-hidden
          className="inline-block h-[9px] rounded-full bg-current"
          style={{ width: `${Math.max(2, word.length) * 6}px` }}
        />
      ))}
    </span>
  );
}
