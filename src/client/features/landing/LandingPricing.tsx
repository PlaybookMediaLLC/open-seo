import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { IconArrowRight } from "@tabler/icons-react";
import { cn } from "cn";
import { Reveal } from "./LandingPrimitives";

type Billing = "monthly" | "topup";

export function LandingPricing({ signedIn }: { signedIn: boolean }) {
  const [billing, setBilling] = useState<Billing>("monthly");
  const start = signedIn ? "/app" : "/sign-in";
  return (
    <section id="pricing" className="w-full px-4 pb-16 pt-32">
      <Reveal className="mb-12 flex justify-center">
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
                "relative rounded-full px-4 py-2.5 text-sm font-medium transition-colors duration-300",
                billing === value
                  ? "landing-pill-rim bg-[#1c1d1f] text-[#fafafa]"
                  : "text-[#888b91] hover:text-[#c4c5c9]",
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
        className="mx-auto flex max-w-[1200px] flex-col items-stretch justify-center gap-6 lg:flex-row"
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
            href: "mailto:team@playbookmedia.io?subject=Relay%20Agency",
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
        "flex w-full flex-col rounded-[20px] p-8 lg:w-[384px]",
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
