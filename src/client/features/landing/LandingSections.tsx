import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { IconArrowRight } from "@tabler/icons-react";
import { cn } from "cn";
import { BrandMark } from "@/client/components/BrandMark";
import { Eyebrow, Reveal } from "./LandingPrimitives";

const AUDIENCES = [
  {
    name: "Founders",
    role: "Ship SEO without hiring for it",
    quote:
      "Connect Search Console, read this week’s three opportunities, approve the fix. That is the whole SEO meeting.",
  },
  {
    name: "Agencies",
    role: "One workspace per client",
    quote:
      "Projects, shareable reports and rank tracking for every client, at data cost instead of per-seat pricing.",
  },
  {
    name: "Developers",
    role: "SEO from the terminal",
    quote:
      "Point Claude Code or Codex at the MCP server and it researches, audits and opens the pull request.",
  },
  {
    name: "Content teams",
    role: "Write what will rank",
    quote:
      "Keyword clusters, SERP checks and AI-answer tracking in one place, tied to pages you already have.",
  },
];

export function LandingAudiences() {
  const [active, setActive] = useState(0);
  const current = AUDIENCES[active] ?? AUDIENCES[0];
  return (
    <section className="landing-dusk px-4 pb-28 pt-24">
      <Reveal className="text-center">
        <Eyebrow className="text-[#f39bd0]">Who it’s for</Eyebrow>
        <h2 className="mt-3 text-[34px] font-semibold leading-[1.1] tracking-[-1.4px] text-white sm:text-[44px]">
          Loved by builders,
          <br />
          built for how you work
        </h2>
      </Reveal>
      <Reveal
        delay={120}
        className="mx-auto mt-14 grid max-w-[820px] items-center gap-10 md:grid-cols-[1.4fr_1fr]"
      >
        <div className="relative">
          <span className="absolute inset-0 translate-x-3 translate-y-3 rotate-2 rounded-2xl bg-white/30" />
          <span className="absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-1 rounded-2xl bg-white/50" />
          <div className="relative rounded-2xl bg-gradient-to-b from-[#f4f4f6] to-[#d9d9de] p-5 text-left shadow-2xl">
            <p className="flex items-center gap-2 text-[17px] font-semibold text-black">
              <BrandMark className="size-6" /> {current.name}
            </p>
            <p className="text-sm text-black/55">{current.role}</p>
            <div className="mt-4 rounded-2xl bg-white p-4 text-[15px] leading-relaxed text-black/80 shadow-sm">
              {current.quote}
            </div>
          </div>
        </div>
        <div className="text-left">
          <p className="text-lg font-medium text-white">Use cases</p>
          <p className="text-xs text-white/50">Pick yours</p>
          <div className="mt-4 space-y-1">
            {AUDIENCES.map((audience, index) => (
              <button
                key={audience.name}
                type="button"
                onClick={() => setActive(index)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                  index === active ? "bg-white/15" : "hover:bg-white/5",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    index === active ? "bg-transparent" : "bg-[#3d8bff]",
                  )}
                />
                <span>
                  <span className="block text-sm text-white">
                    {audience.name}
                  </span>
                  <span className="block text-xs text-white/50">
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
    <section id="pricing" className="px-4 py-24">
      <Reveal className="flex justify-center">
        <div className="flex rounded-full bg-white/[0.06] p-1 text-sm">
          {(
            [
              ["monthly", "Monthly"],
              ["topup", "Top-ups"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setBilling(value)}
              className={cn(
                "rounded-full px-4 py-1.5 transition-colors",
                billing === value
                  ? "bg-white/15 text-white"
                  : "text-white/55 hover:text-white",
              )}
            >
              {label}
              {value === "topup" ? (
                <span className="ml-1.5 text-xs text-white/40">
                  (pay as you go)
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </Reveal>
      <Reveal
        delay={100}
        className="mx-auto mt-8 grid max-w-[1000px] gap-4 md:grid-cols-3"
      >
        <PlanCard
          name="Free"
          price="0"
          tagline="Must-have research for everyday use."
          features={[
            "1,000 data credits every month",
            "Google Search Console insights",
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
          note="We reply within one business day"
        />
      </Reveal>
    </section>
  );
}

function PlanCard({
  name,
  price,
  unit,
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
  tagline: string;
  lead?: string;
  features: string[];
  cta: { label: string; to?: string; href?: string };
  note: string;
  featured?: boolean;
}) {
  const numeric = /^\d/.test(price);
  const ctaClass = cn(
    "mt-8 flex h-11 items-center justify-between rounded-full px-4 text-sm transition-colors",
    featured
      ? "bg-black text-white hover:bg-black/80"
      : "bg-white/[0.07] text-white/80 hover:bg-white/[0.12]",
  );
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border p-6",
        featured
          ? "border-white/10 bg-gradient-to-b from-[#060a2a] via-[#1e3570] to-[#5a75b8]"
          : "border-white/[0.07] bg-[#111113]",
      )}
    >
      <p className="text-[17px] text-white">{name}</p>
      <p className="mt-3 flex items-start gap-0.5 text-white">
        {numeric ? (
          <span className="mt-1 text-2xl font-semibold">$</span>
        ) : null}
        <span
          className={cn(
            "font-semibold tracking-tight",
            numeric ? "text-6xl" : "text-5xl leading-[60px]",
          )}
        >
          {price}
        </span>
        {unit ? (
          <span className="ml-1 self-end pb-2 text-sm text-white/60">
            {unit}
          </span>
        ) : null}
      </p>
      <p className="mt-3 text-sm text-white/60">{tagline}</p>
      <div className="my-6 h-px bg-white/10" />
      {lead ? <p className="mb-3 text-sm text-white">{lead}</p> : null}
      <ul className="flex-1 space-y-3 text-sm text-white/65">
        {features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      {cta.href ? (
        <a href={cta.href} className={ctaClass}>
          {cta.label}
          <IconArrowRight className="size-4" />
        </a>
      ) : (
        <Link to={cta.to ?? "/sign-in"} className={ctaClass}>
          {cta.label}
          <IconArrowRight className="size-4" />
        </Link>
      )}
      <p className="mt-3 text-center text-xs text-white/45">{note}</p>
    </div>
  );
}
