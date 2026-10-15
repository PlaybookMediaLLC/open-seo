import * as React from "react";
import { projectsQueryOptions } from "@/client/features/projects/projectQueries";
import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  MissingSeoSetupModal,
  SeoApiStatusBanners,
} from "@/client/layout/AppShellParts";
import { GscReEngagementModal } from "@/client/features/gsc/GscReEngagementModal";
import { Sidebar } from "@/client/components/Sidebar";
import { BILLING_ROUTE } from "@/shared/billing";
import { getSeoApiKeyStatus } from "@/serverFunctions/config";
import { getLastProjectId } from "@/client/lib/active-project";
import { dataforseoHelpLinkOptions } from "@/client/navigation/items";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/client/components/ui/sidebar";
import { BrandMark } from "@/client/components/BrandMark";

export function AuthenticatedAppLayout({
  children,
  projectId,
  ready,
  banner,
}: {
  children: React.ReactNode;
  projectId?: string;
  /** The session is confirmed. Until then the shell renders but loads nothing. */
  ready: boolean;
  banner?: React.ReactNode;
}) {
  const location = useLocation();
  const [showMissingSeoApiKeyModal, setShowMissingSeoApiKeyModal] =
    React.useState(false);
  // On non-project pages (e.g. /settings) there's no projectId in the URL, so
  // derive one for the nav/switcher: prefer the last-visited project, else the
  // most recent. The whole app tree is client-only (see root ClientOnly), so we
  // can read localStorage synchronously during render — this lets the sidebar
  // show the full project nav on the very first paint instead of briefly
  // flashing only the always-visible Connect group while projects load. It is
  // read on every render, not once: the shell stays mounted across project
  // pages, which update the remembered project as the user moves between them.
  const projectsQuery = useQuery({
    ...projectsQueryOptions(),
    enabled: ready && !projectId,
  });
  const rememberedProjectId = getLastProjectId();
  const fallbackProjects = projectsQuery.data ?? [];
  const fallbackProjectId =
    fallbackProjects.find((project) => project.id === rememberedProjectId)
      ?.id ??
    fallbackProjects[0]?.id ??
    null;
  // Once the projects list loads, fallbackProjectId is the validated choice
  // (remembered-if-valid, else most recent). Before it loads, fall back to the
  // remembered id so the project nav renders immediately; a stale id here only
  // builds links that self-correct via the route guard once data arrives.
  const sidebarProjectId =
    projectId ?? fallbackProjectId ?? rememberedProjectId;
  // No project to show yet, but the list that may name one is still loading
  // (a first visit to a page without a project in the URL).
  const sidebarProjectPending =
    sidebarProjectId === null && projectsQuery.isPending;
  // GSC opportunities, experiments and publishing setup do not use DataForSEO. Do not
  // interrupt their review/approval flow with an unrelated paid-research modal.
  const isGrowthWorkflow =
    /^\/p\/[^/]+\/(?:opportunities(?:\/|$)|experiments(?:\/|$)|settings\/integrations(?:\/|$))/.test(
      location.pathname,
    );
  // The setup guide also needs no banner linking back to itself.
  const shouldCheckSeoApiKeyStatus =
    !isGrowthWorkflow &&
    location.pathname !== BILLING_ROUTE &&
    location.pathname !== dataforseoHelpLinkOptions.to;
  const seoApiKeyStatusQuery = useQuery({
    queryKey: ["seoApiKeyStatus"],
    queryFn: () => getSeoApiKeyStatus(),
    enabled: ready && shouldCheckSeoApiKeyStatus,
  });
  const isSeoApiKeyConfigured = shouldCheckSeoApiKeyStatus
    ? (seoApiKeyStatusQuery.data?.configured ?? null)
    : null;
  const seoApiKeyStatusError =
    shouldCheckSeoApiKeyStatus && seoApiKeyStatusQuery.isError;

  React.useEffect(() => {
    if (!shouldCheckSeoApiKeyStatus) {
      setShowMissingSeoApiKeyModal(false);
      return;
    }

    if (seoApiKeyStatusQuery.isError) {
      setShowMissingSeoApiKeyModal(false);
      return;
    }

    if (!seoApiKeyStatusQuery.isSuccess) return;
    setShowMissingSeoApiKeyModal(!seoApiKeyStatusQuery.data.configured);
  }, [
    location.pathname,
    seoApiKeyStatusQuery.data,
    seoApiKeyStatusQuery.isError,
    seoApiKeyStatusQuery.isSuccess,
    shouldCheckSeoApiKeyStatus,
  ]);

  const shouldShowSeoApiWarning =
    !seoApiKeyStatusError &&
    isSeoApiKeyConfigured === false &&
    !showMissingSeoApiKeyModal;

  return (
    <SidebarProvider
      // The sidebar remembers its rail or open state across reloads.
      defaultOpen={!document.cookie.split("; ").includes("sidebar_state=false")}
      className="h-[100dvh] min-h-0 overflow-hidden"
    >
      <Sidebar
        projectId={sidebarProjectId}
        projectPending={sidebarProjectPending}
        ready={ready}
      />
      {/* A floating frame on desktop: soft corners, a hairline edge and a
          whisper of depth, so the page reads as one sheet on the sidebar. */}
      <SidebarInset
        data-shell-chrome
        className="min-h-0 overflow-hidden md:!m-2 md:!ml-0 md:!rounded-xl md:border md:border-sidebar-border md:!shadow-[0_1px_3px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.08)]"
      >
        <TopBar />
        <SeoApiStatusBanners
          shouldShowSeoApiWarning={shouldShowSeoApiWarning}
          seoApiKeyStatusError={seoApiKeyStatusError}
        />
        {banner}
        <div className="min-h-0 flex-1 overflow-auto [--radius:0rem]">
          {children}
        </div>
      </SidebarInset>

      {showMissingSeoApiKeyModal ? (
        <MissingSeoSetupModal
          onClose={() => setShowMissingSeoApiKeyModal(false)}
        />
      ) : null}

      {ready ? (
        <GscReEngagementModal
          projectId={sidebarProjectId}
          suppressed={showMissingSeoApiKeyModal}
        />
      ) : null}
    </SidebarProvider>
  );
}

// Mobile: the drawer button and brand. Desktop has the sidebar's icon rail
// when collapsed, so it needs no strip.
function TopBar() {
  const { isMobile } = useSidebar();
  if (!isMobile) return null;
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border/70 bg-background/80 px-2 backdrop-blur-md">
      <SidebarTrigger
        aria-label="Toggle sidebar"
        className="text-muted-foreground hover:text-foreground"
      />
      <Link
        to="/app"
        className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground"
      >
        <BrandMark className="size-5" />
        OpenSEO
      </Link>
    </div>
  );
}
