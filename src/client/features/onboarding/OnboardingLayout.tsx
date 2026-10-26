import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "cn";

export type OnboardingStepCopy = {
  label: string;
  description: string;
  /** Shown in the rail's "Good to know" panel while the step is open. */
  why: string;
};

function Logo({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center gap-2 text-sm font-semibold", className)}
    >
      <img src="/transparent-logo.png" alt="" className="size-7" />
      OpenSEO
    </div>
  );
}

/**
 * Full-page onboarding frame: a step rail on the left (a compact header on
 * small screens) and a scrolling content column. `step` indexes `steps`;
 * -1 is the welcome screen, which comes before the numbered steps.
 */
export function OnboardingLayout({
  step,
  steps,
  why,
  onStepChange,
  disabled,
  accountMenu,
  children,
}: {
  step: number;
  steps: OnboardingStepCopy[];
  why: string;
  onStepChange: (index: number) => void;
  disabled: boolean;
  accountMenu: ReactNode;
  children: ReactNode;
}) {
  // The content column scrolls on its own, so a new step would otherwise open
  // at the previous step's scroll position. Focus its heading too, so screen
  // readers announce the new step. Skip the first render to leave the page's
  // initial focus alone.
  const contentRef = useRef<HTMLDivElement>(null);
  const firstStep = useRef(step);
  useEffect(() => {
    if (step === firstStep.current) return;
    // NaN equals no step, so returning to the first step still resets.
    firstStep.current = Number.NaN;
    contentRef.current?.scrollTo({ top: 0 });
    contentRef.current
      ?.querySelector<HTMLElement>("h1")
      ?.focus({ preventScroll: true });
  }, [step]);

  return (
    <div className="flex h-dvh bg-background">
      <aside className="hidden w-[400px] shrink-0 flex-col border-r border-border bg-muted/40 p-10 lg:flex">
        <Logo />
        <nav aria-label="Onboarding steps" className="mt-14">
          <ol className="space-y-1">
            {steps.map(({ label, description }, index) => (
              <li key={label} className="relative">
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute top-10 -bottom-1 left-6 w-px -translate-x-1/2 bg-border"
                  />
                ) : null}
                <button
                  type="button"
                  aria-current={index === step ? "step" : undefined}
                  disabled={disabled}
                  onClick={() => onStepChange(index)}
                  className="relative flex w-full cursor-pointer items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-background/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default aria-[current=step]:bg-background aria-[current=step]:shadow-sm"
                >
                  <span
                    className={cn(
                      "relative flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                      index === step
                        ? "border-primary bg-primary text-primary-foreground"
                        : index < step
                          ? "border-foreground/30 bg-background text-foreground"
                          : "border-border bg-background text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-sm font-medium",
                        index > step && "text-muted-foreground",
                      )}
                    >
                      {label}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {description}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="mt-auto rounded-xl border border-border bg-background p-5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Good to know
          </p>
          <p className="mt-2 text-sm leading-relaxed text-pretty text-foreground/80">
            {why}
          </p>
        </div>
      </aside>

      <div
        ref={contentRef}
        className="flex min-w-0 flex-1 flex-col overflow-y-auto"
      >
        {accountMenu}
        <header className="flex h-16 shrink-0 items-center gap-3 px-6 pr-16 lg:px-16">
          <Logo className="lg:hidden" />
          <p className="ml-auto text-sm text-muted-foreground lg:ml-0">
            {step >= 0 ? (
              <>
                Step {step + 1} of {steps.length}
                <span className="lg:hidden"> · {steps[step]?.label}</span>
              </>
            ) : null}
          </p>
        </header>
        <div className="h-1 shrink-0 bg-border lg:hidden" aria-hidden>
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
        <main className="flex-1 px-6 pt-10 pb-6 lg:px-16 lg:pt-16">
          <div
            key={step}
            className="mx-auto w-full max-w-2xl duration-300 animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

/** Heading block shared by every onboarding step. */
export function OnboardingStepHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <h1
        tabIndex={-1}
        className="text-3xl font-semibold tracking-tight text-balance outline-none"
      >
        {title}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-pretty text-muted-foreground">
        {description}
      </p>
      {children}
    </div>
  );
}
