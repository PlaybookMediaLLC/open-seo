import type { ReactNode } from "react";
import { OnboardingLayout, type OnboardingStepCopy } from "./OnboardingLayout";
import { ONBOARDING_STEPS } from "./onboardingModel";
import { WelcomeOnboardingStep } from "./WelcomeOnboardingStep";
import { WebsiteOnboardingStep } from "./WebsiteOnboardingStep";
import { AgentSetup } from "@/client/features/ai-mcp/AgentSetup";
import { SearchConsoleOnboardingStep } from "./SearchConsoleOnboardingStep";
import { AnalyticsOnboardingStep } from "./AnalyticsOnboardingStep";

// The numbered steps in the rail, in ONBOARDING_STEPS order after "welcome".
const STEPS: OnboardingStepCopy[] = [
  {
    label: "Your website",
    description: "Where the first audit runs",
    why: "The audit runs while you finish setup, so your dashboard has results waiting when you get there.",
  },
  {
    label: "Search Console",
    description: "Your real search data",
    why: "Search Console is how OpenSEO ranks fixes by the clicks they'd win. Access is read-only, and you can disconnect anytime.",
  },
  {
    label: "Preferences",
    description: "Analytics and email",
    why: "Your Google data stays read-only, and it's never sold or used for advertising.",
  },
  {
    label: "Your agent",
    description: "Let it do the work",
    why: "Prefer clicking? Skip this. Everything your agent can do also works from the dashboard.",
  },
];

const WELCOME_WHY =
  "Four quick steps. Skip any of them and finish it later from Settings.";

type PostSignupOnboardingProps = {
  step: number;
  onNext: () => void;
  onBack: () => void;
  onStepChange: (step: number) => void;
  onSkip: () => void;
  onFinish: () => void;
  isSaving: boolean;
  accountMenu: ReactNode;
  /** Prefill for the website step, from the marketing site's free check. */
  suggestedDomain?: string;
};

export function PostSignupOnboarding({
  step,
  onNext,
  onBack,
  onStepChange,
  onSkip,
  onFinish,
  isSaving,
  accountMenu,
  suggestedDomain,
}: PostSignupOnboardingProps) {
  // The rail counts from the first real step; the welcome screen is -1.
  const railStep = step - 1;

  return (
    <OnboardingLayout
      step={railStep}
      steps={STEPS}
      why={railStep < 0 ? WELCOME_WHY : STEPS[railStep].why}
      onStepChange={(index) => onStepChange(index + 1)}
      disabled={isSaving}
      accountMenu={accountMenu}
    >
      <fieldset disabled={isSaving} className="min-w-0">
        {ONBOARDING_STEPS[step] === "welcome" ? (
          <WelcomeOnboardingStep onNext={onNext} />
        ) : ONBOARDING_STEPS[step] === "website" ? (
          <WebsiteOnboardingStep
            onNext={onNext}
            onBack={onBack}
            onSkip={onSkip}
            suggestedDomain={suggestedDomain}
          />
        ) : ONBOARDING_STEPS[step] === "search_console" ? (
          <SearchConsoleOnboardingStep
            onNext={onNext}
            onBack={onBack}
            onSkip={onSkip}
          />
        ) : ONBOARDING_STEPS[step] === "analytics" ? (
          <AnalyticsOnboardingStep onBack={onBack} onNext={onNext} />
        ) : (
          <AgentSetup onFinish={onFinish} onBack={onBack} />
        )}
      </fieldset>
    </OnboardingLayout>
  );
}
