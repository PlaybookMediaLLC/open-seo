import { useEffect, useEffectEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IconArrowRight as ArrowRight,
  IconCheck as Check,
} from "@tabler/icons-react";
import { AgentList } from "./AgentList";
import { AGENT_SETUP_LINKS } from "./agentInstalls";
import { AgentSetupPanel } from "./AgentSetupPanel";
import { getAgentSetupPrompt } from "./agentSetupPrompt";
import { captureClientEvent } from "@/client/lib/posthog";
import { OnboardingStepHeader } from "@/client/features/onboarding/OnboardingLayout";
import { WizardFooter } from "@/client/features/onboarding/WizardFooter";
import { Spinner as SpinnerIcon } from "@/client/components/ui/spinner";
import { Button } from "@/client/components/ui/button";
import { getMcpAuthorizedAt } from "@/serverFunctions/onboarding";

/** Last onboarding step. Onboarding finishes when the user clicks Go to
 *  dashboard, or when their agent connects over MCP (the server marks it). */
export function AgentSetup({
  onFinish,
  onBack,
}: {
  onFinish: () => void;
  onBack: () => void;
}) {
  const prompt = getAgentSetupPrompt(window.location.origin);
  const [copied, setCopied] = useState(false);
  // Once the user copies the prompt or opens an agent listing, Go to dashboard
  // becomes the main button.
  const [startedSetup, setStartedSetup] = useState(false);
  // Polls while the tab is visible, so the step moves on within a few seconds
  // of the user returning from their agent.
  const { data } = useQuery({
    queryKey: ["mcpAuthorizedAt"],
    queryFn: () => getMcpAuthorizedAt(),
    refetchInterval: 3_000,
  });
  const connected = Boolean(data?.authorizedAt);

  // Leave "Connected" on screen briefly before moving on.
  const finish = useEffectEvent(onFinish);
  useEffect(() => {
    if (!connected) return;
    const timer = setTimeout(finish, 1_500);
    return () => clearTimeout(timer);
  }, [connected]);

  return (
    <div>
      <OnboardingStepHeader
        title="Hand the work to your agent"
        description="Paste one prompt into your agent. It connects to OpenSEO, then runs the research and audits and ships the fixes for you."
      >
        <AgentList />
      </OnboardingStepHeader>
      <AgentSetupPanel
        prompt={prompt}
        copyVariant={startedSetup ? "outline" : "default"}
        onCopy={() => {
          setCopied(true);
          setStartedSetup(true);
          captureClientEvent("onboarding:setup_prompt_copy");
        }}
        actions={AGENT_SETUP_LINKS.map(({ agent, name, href, Icon }) => (
          <Button
            key={agent}
            variant="outline"
            size="lg"
            className="w-full"
            nativeButton={false}
            render={<a href={href} target="_blank" rel="noreferrer" />}
            onClick={() => {
              setStartedSetup(true);
              captureClientEvent("onboarding:add_to_agent_click", { agent });
            }}
          >
            <Icon data-icon="inline-start" />
            {/* "Add to" drops on narrow screens so both buttons fit one row. */}
            <span>
              <span className="max-sm:sr-only">Set up </span>
              {name}
            </span>
          </Button>
        ))}
      >
        {connected ? (
          <p
            role="status"
            className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm font-medium text-success"
          >
            <Check className="size-4" aria-hidden />
            Connected. Taking you to your dashboard…
          </p>
        ) : copied ? (
          <p
            role="status"
            className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <SpinnerIcon className="size-3.5" />
            Paste it into your agent and approve the connection. We'll move on
            once it connects.
          </p>
        ) : null}
      </AgentSetupPanel>
      <WizardFooter
        onBack={onBack}
        continueAction={
          <Button
            type="button"
            variant={startedSetup ? "default" : "ghost"}
            className={
              startedSetup
                ? "font-semibold"
                : "h-8 gap-2 px-3 text-xs font-semibold"
            }
            onClick={onFinish}
          >
            Go to dashboard <ArrowRight className="size-4" />
          </Button>
        }
      />
    </div>
  );
}
