import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { IconArrowRight } from "@tabler/icons-react";
import { cn } from "cn";
import { BrandMark } from "@/client/components/BrandMark";
import { Eyebrow, Reveal, useAutoCycle } from "./LandingPrimitives";

const AUDIENCES = [
  {
    name: "Founders",
    role: "Ship SEO without hiring",
    initials: "F",
    tint: "#ffb764",
    quote:
      "Connect Search Console, read this week’s three opportunities, approve the fix. That is the whole SEO meeting now.",
  },
  {
    name: "Agencies",
    role: "One workspace per client",
    initials: "A",
    tint: "#7fb2ff",
    quote:
      "Projects, shareable reports and rank tracking for every client, at data cost instead of per-seat pricing.",
  },
  {
    name: "Developers",
    role: "SEO from the terminal",
    initials: "D",
    tint: "#1cecbb",
    quote:
      "I point Claude Code at the OpenSEO MCP server. It researches, audits and opens the pull request for me.",
  },
  {
    name: "Content teams",
    role: "Write what will rank",
    initials: "C",
    tint: "#dd55e7",
    quote:
      "Keyword clusters, SERP checks and AI-answer tracking in one place, tied to pages we already have.",
  },
];

export function LandingAudiences() {
  const [active, pick] = useAutoCycle(AUDIENCES.length, 5000);
  const current = AUDIENCES[active] ?? AUDIENCES[0];
  return (
    <section className="landing-dusk relative w-full px-4 pb-40 pt-40">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-black" />
      <Reveal className="text-center">
        <Eyebrow color="#f39bd0">Who it’s for</Eyebrow>
        <h2 className="mt-4 text-[36px] font-semibold leading-[38px] tracking-[-1.2px] text-[#fafafa] sm:text-[48px] sm:leading-[51px]">
          Loved by builders,
          <br />
          built for how you work
        </h2>
      </Reveal>
      <Reveal
        delay={120}
        className="mx-auto mt-16 grid max-w-[880px] items-center gap-12 md:grid-cols-[1.5fr_1fr]"
      >
        <div className="relative mx-auto w-full max-w-[520px]">
          <span className="absolute inset-0 translate-x-4 translate-y-4 rotate-2 rounded-[24px] bg-white/25" />
          <span className="absolute inset-0 translate-x-2 translate-y-2 rotate-1 rounded-[24px] bg-white/45" />
          <div
            key={current.name}
            className="landing-reveal relative -rotate-2 rounded-[24px] bg-gradient-to-b from-[#f1f1f3] to-[#d6d6db] p-4 text-left shadow-[0_1px_4px_rgb(0_0_0/0.25),0_4px_59px_rgb(0_0_0/0.1)]"
            data-visible=""
          >
            <div className="flex items-center gap-3 px-2 py-1">
              <span
                className="grid size-10 place-items-center rounded-full text-[15px] font-semibold text-black ring-2 ring-white/60"
                style={{ background: current.tint }}
              >
                {current.initials}
              </span>
              <span>
                <span className="block text-[18px] font-medium leading-6 text-black">
                  {current.name}
                </span>
                <span className="block text-sm text-black/60">
                  {current.role}
                </span>
              </span>
            </div>
            <div className="mt-3 rounded-[18px] bg-white p-5 text-[16px] leading-[24px] text-black/80 shadow-sm">
              {current.quote}
              <span className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-[#3d8bff]">
                <BrandMark className="size-4" /> @openseo
              </span>
            </div>
          </div>
        </div>
        <div className="text-left">
          <p className="text-[18px] font-medium text-white">Use cases</p>
          <p className="text-[13px] text-white/60">Pick yours</p>
          <div className="mt-4 space-y-1">
            {AUDIENCES.map((audience, index) => (
              <button
                key={audience.name}
                type="button"
                onClick={() => pick(index)}
                className={cn(
                  "flex w-full max-w-[220px] items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                  index === active ? "bg-white/15" : "hover:bg-white/5",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    index === active ? "bg-transparent" : "bg-[#3d8bff]",
                  )}
                />
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-black"
                  style={{ background: audience.tint }}
                >
                  {audience.initials}
                </span>
                <span>
                  <span className="block text-[14px] font-medium text-white">
                    {audience.name}
                  </span>
                  <span className="block text-[12px] text-white/55">
                    {audience.role}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

type Billing = "monthly" | "topup";

export function LandingPricing({ signedIn }: { signedIn: boolean }) {
  const [billing, setBilling] = useState<Billing>("monthly");
  const start = signedIn ? "/app" : "/sign-in";
  return (
    <section id="pricing" className="w-full px-4 pb-24 pt-32">
      <Reveal className="flex justify-center">
        <div className="relative flex items-center rounded-full bg-[#0f0f10] p-1.5">
          {(
            [
              ["monthly", "Monthly", null],
              ["topup", "Top-ups", "(pay as you go)"],
            ] as const
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => setBilling(value)}
              className={cn(
                "rounded-full px-4 py-2.5 text-sm font-medium transition-colors duration-300",
                billing === value
                  ? "bg-[#1c1d1f] text-[#fafafa] shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
                  : "text-[#888b91] hover:text-white",
              )}
            >
              {label}
              {hint ? (
                <span className="ml-1.5 text-xs font-normal text-[#70757c]">
                  {hint}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </Reveal>
      <Reveal
        delay={100}
        className="mx-auto mt-8 grid max-w-[1232px] gap-4 md:grid-cols-3"
      >
        <PlanCard
          name="Free"
          price="0"
          tagline="Must-have research for everyday use."
          features={[
            "1,000 data credits every month",
            "Search Console insights",
            "Opportunities and experiments",
            "Keyword and domain research",
            "Agent access over MCP",
          ]}
          cta={{ label: "Get started", to: start }}
          note="Sign in with Google, no card required"
        />
        <PlanCard
          featured
          name="Base"
          price={billing === "monthly" ? "10" : "1"}
          unit={billing === "monthly" ? "/month" : "/1,000 credits"}
          badge="Most popular"
          tagline="More data for a growing site."
          lead="Everything in Free, plus:"
          features={[
            "10,000 data credits every month",
            "Rank tracking and site audits",
            "Backlinks and AI visibility",
            "Shareable client reports",
            "Top up anytime at $1 per 1,000",
          ]}
          cta={{ label: "Upgrade", to: start }}
          note="Cancel anytime from billing"
        />
        <PlanCard
          name="Agency"
          price="Custom"
          tagline="For teams managing many sites."
          lead="Everything in Base, plus:"
          features={[
            "Volume data pricing",
            "Unlimited client projects",
            "Team members and roles",
            "Priority email support",
          ]}
          cta={{
            label: "Contact us",
            href: "mailto:team@playbookmedia.io?subject=OpenSEO%20Agency",
          }}
          note="We’ll get back to you within 24 hours"
        />
      </Reveal>
    </section>
  );
}

function PlanCard({
  name,
  price,
  unit,
  badge,
  tagline,
  lead,
  features,
  cta,
  note,
  featured = false,
}: {
  name: string;
  price: string;
  unit?: string;
  badge?: string;
  tagline: string;
  lead?: string;
  features: string[];
  cta: { label: string; to?: string; href?: string };
  note: string;
  featured?: boolean;
}) {
  const numeric = /^\d/.test(price);
  const ctaClass = cn(
    "group mt-8 flex w-full items-center justify-between rounded-full px-5 py-3.5 text-[16px] font-medium transition-colors",
    featured
      ? "bg-black text-[#fafafa]"
      : "bg-[#1c1d1f] text-white/60 hover:text-white",
  );
  const arrow = (
    <IconArrowRight className="size-[18px] transition-transform group-hover:translate-x-0.5" />
  );
  return (
    <div
      className={cn(
        "flex flex-col rounded-[20px] p-8",
        featured
          ? "landing-price-featured"
          : "border border-[#1c1d1f] bg-[#0f0f10]",
      )}
    >
      <p className="text-[20px] font-medium leading-7 text-[#fafafa]">{name}</p>
      <div className="mt-4 flex items-start gap-1 text-[#fafafa]">
        {numeric ? (
          <span className="mt-1 text-[24px] font-semibold leading-8">$</span>
        ) : null}
        <span className="text-[60px] font-semibold leading-[60px] tracking-[-1.5px]">
          {price}
        </span>
        <span className="ml-1 flex flex-col items-start justify-end self-stretch">
          {badge ? (
            <span className="mb-1 rounded px-2 py-1 text-xs font-medium text-white [background:#7c3aed]">
              {badge}
            </span>
          ) : null}
          {unit ? <span className="text-sm text-white/60">{unit}</span> : null}
        </span>
      </div>
      <p className="mt-4 text-[15px] leading-[22.5px] text-[#888b91]">
        {tagline}
      </p>
      <div className="my-6 h-px bg-white/10" />
      {lead ? (
        <p className="mb-4 text-[15px] font-medium text-[#fafafa]">{lead}</p>
      ) : null}
      <ul
        className={cn(
          "flex-1 space-y-3 text-[15px] leading-[22.5px]",
          featured ? "text-[#fafafa]" : "text-[#888b91]",
        )}
      >
        {features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      {cta.href ? (
        <a href={cta.href} className={ctaClass}>
          {cta.label}
          {arrow}
        </a>
      ) : (
        <Link to={cta.to ?? "/sign-in"} className={ctaClass}>
          {cta.label}
          {arrow}
        </Link>
      )}
      <p
        className={cn(
          "mt-3 text-center text-sm",
          featured ? "text-black/50" : "text-[#70757c]",
        )}
      >
        {note}
      </p>
    </div>
  );
}
