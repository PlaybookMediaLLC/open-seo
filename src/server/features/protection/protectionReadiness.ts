// RFC-0026 phase A (IRFC-0001): the protection readiness checklist, a pure
// function of stored state. "Activation" already names the dashboard's
// onboarding checklist, so this one is readiness.
type ReadinessState = "passed" | "failed" | "not_available" | "not_required";

type ReadinessItem = {
  id:
    | "origin"
    | "repository"
    | "pages"
    | "baseline"
    | "reviewer"
    | "schedule"
    | "repairs"
    | "search_data";
  required: boolean;
  state: ReadinessState;
  message: string;
};

const check = (passed: boolean, yes: string, no: string) =>
  passed
    ? { state: "passed" as const, message: yes }
    : { state: "failed" as const, message: no };

export function protectionReadiness(input: {
  originVerified: boolean;
  allowRepairProposals: boolean;
  allowPullRequests: boolean;
  /** An active publishing connection with a production environment. */
  repositoryConnected: boolean;
  /** Active, non-excluded pages. */
  checkedPageCount: number;
  maxPages: number;
  reviewerChosen: boolean;
  reviewerIsMember: boolean;
  alertConfirmed: boolean;
  searchConsoleConnected: boolean;
  analyticsConnected: boolean;
}) {
  const repositoryRequired =
    input.allowRepairProposals || input.allowPullRequests;
  const pages = input.checkedPageCount;
  const missingData = [
    input.searchConsoleConnected ? null : "Search Console",
    input.analyticsConnected ? null : "Google Analytics",
  ].filter((name) => name !== null);
  const items: ReadinessItem[] = [
    {
      id: "origin",
      required: true,
      ...check(
        input.originVerified,
        "Ownership of the production origin is verified.",
        "Verify that you own the production origin.",
      ),
    },
    {
      id: "repository",
      required: repositoryRequired,
      ...(repositoryRequired
        ? check(
            input.repositoryConnected,
            "The site's repository is connected with a production environment.",
            "Repair proposals or pull requests are on, so connect the site's repository with a production environment, or turn them off.",
          )
        : {
            state: "not_required" as const,
            message:
              "No repository is needed while repair proposals and pull requests are off.",
          }),
    },
    {
      id: "pages",
      required: true,
      ...check(
        pages >= 1 && pages <= input.maxPages,
        `${pages} ${pages === 1 ? "page is" : "pages are"} in scope.`,
        pages === 0
          ? "Choose at least one page to protect."
          : `Protect at most ${input.maxPages} pages.`,
      ),
    },
    {
      id: "baseline",
      required: true,
      state: "not_available",
      message:
        "Known-good baselines are not available yet. They arrive with scheduled checks.",
    },
    {
      id: "reviewer",
      required: true,
      ...check(
        input.reviewerChosen && input.reviewerIsMember && input.alertConfirmed,
        "The reviewer confirmed a test alert.",
        !input.reviewerChosen
          ? "Choose a reviewer."
          : !input.reviewerIsMember
            ? "The reviewer is no longer a member of this organization. Choose another."
            : "The reviewer has not confirmed a test alert yet.",
      ),
    },
    {
      id: "schedule",
      required: true,
      state: "not_available",
      message:
        "Scheduled daily checks are not available yet, so protection cannot be activated.",
    },
    {
      id: "repairs",
      required: false,
      state: "not_available",
      message: "Repair proposals are not available yet.",
    },
    {
      id: "search_data",
      required: false,
      ...(missingData.length
        ? {
            state: "not_available" as const,
            message: `${missingData.join(" and ")} ${missingData.length === 1 ? "is" : "are"} not connected. Technical protection works without search data.`,
          }
        : {
            state: "passed" as const,
            message: "Search Console and Google Analytics are connected.",
          }),
    },
  ];
  const requiredPass = (skip: ReadinessItem["id"] | null) =>
    items.every(
      (item) => !item.required || item.id === skip || item.state === "passed",
    );
  return {
    items,
    canActivate: requiredPass(null),
    // Checks stop while paused, so the schedule's freshness cannot hold.
    canResume: requiredPass("schedule"),
  };
}
