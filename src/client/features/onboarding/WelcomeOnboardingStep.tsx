import {
  IconArrowRight as ArrowRight,
  IconChecklist as Checklist,
  IconGitPullRequest as PullRequest,
  IconListNumbers as Ranked,
} from "@tabler/icons-react";
import { Button } from "@/client/components/ui/button";
import { OnboardingStepHeader } from "./OnboardingLayout";

const WHAT_YOU_GET = [
  {
    Icon: Checklist,
    title: "A site audit, started now",
    body: "Crawl issues and Lighthouse scores, prioritized.",
  },
  {
    Icon: Ranked,
    title: "Fixes ranked by clicks",
    body: "Your Search Console data, turned into a weekly to-do list.",
  },
  {
    Icon: PullRequest,
    title: "Your agent ships them",
    body: "Point Claude Code or Cursor at OpenSEO and it opens the pull request.",
  },
];

/** Playbook fork: first screen of onboarding, before the numbered steps. */
export function WelcomeOnboardingStep({ onNext }: { onNext: () => void }) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-primary">
        Welcome to OpenSEO
      </p>
      <OnboardingStepHeader
        title="Set it up once. Get a ranked to‑do list every week."
        description="Add your site, connect Search Console and OpenSEO ranks the fixes worth making. It takes about three minutes, and you can skip anything and finish it later."
      />
      <ul className="grid gap-3 sm:grid-cols-3">
        {WHAT_YOU_GET.map(({ Icon, title, body }) => (
          <li
            key={title}
            className="flex gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:block"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="sm:mt-4">
              <p className="text-sm font-medium">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Button
          type="button"
          size="lg"
          className="font-semibold"
          onClick={onNext}
        >
          Get started <ArrowRight className="size-4" />
        </Button>
        <span className="text-sm text-muted-foreground">About 3 minutes</span>
      </div>
    </div>
  );
}
