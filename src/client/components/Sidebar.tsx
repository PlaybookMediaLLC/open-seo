// oxlint-disable max-lines -- keep upstream account controls beside Relay's sidebar rail for upstream sync
import { Link, useLocation, useMatchRoute } from "@tanstack/react-router";
import type { LinkOptions } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ComponentType } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import {
  IconArrowsLeftRight as ArrowLeftRight,
  IconCheck as Check,
  IconChevronLeft as ChevronLeft,
  IconHelpCircle as CircleHelp,
  IconCreditCard as CreditCard,
  IconLogout as LogOut,
  IconSettings as Settings,
  IconSelector as Selector,
} from "@tabler/icons-react";
import { organizationContextQueryOptions } from "@/client/features/team/organizationQueries";
import { switchOrganization } from "@/serverFunctions/organization";
import { clearLastProjectId } from "@/client/lib/active-project";
import {
  connectNavGroup,
  getProjectNavGroups,
  getProjectNavGroup,
} from "@/client/navigation/items";
import { ProjectSwitcher } from "@/client/features/projects/ProjectSwitcher";
import { NotificationsBell } from "@/client/features/notifications/NotificationsBell"; // playbook-seam
import {
  SamChatListSkeleton,
  SamSidebarPanel,
} from "@/client/features/sam/SamSidebarPanel";
import { ThemePreferenceRadio } from "@/client/components/ThemePreferenceMenuItems";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { signOutAndRedirect, useSession } from "@/lib/auth-client";
import { isEveryAppClientAuthMode } from "@/lib/auth-mode";
import { everyAppAccountQueryOptions } from "@/client/features/every-app/everyAppAccountQueries";
import { BILLING_ROUTE } from "@/shared/billing";
import {
  Sidebar as UiSidebar,
  SidebarContent,
  SidebarFooter as UiSidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  useSidebar,
} from "@/client/components/ui/sidebar";
import {
  SidebarBrand,
  useDesktopShortcut,
  useRail,
} from "@/client/components/SidebarChrome";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";

// Quiet rows that brighten on hover; the active row is a soft raised pill.
// In the collapsed rail the same rows become 32px icon buttons.
const navButtonClass =
  "h-10 gap-2.5 rounded-lg px-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground data-active:bg-sidebar-active data-active:font-medium data-active:text-sidebar-accent-foreground data-active:shadow-[0_1px_2px_rgb(0_0_0/0.06),inset_0_0_0_1px_var(--sidebar-border)] [&_svg]:size-4";

function SidebarNavLink({
  icon: Icon,
  label,
  linkProps,
  placeholder = false,
  active = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  linkProps: LinkOptions;
  /** Show the row without its link, while its project is still unknown. */
  placeholder?: boolean;
  active?: boolean;
}) {
  const { setOpenMobile } = useSidebar();
  const matchRoute = useMatchRoute();
  const isPromptHistory =
    linkProps.to === "/p/$projectId/ai-visibility" &&
    Boolean(
      matchRoute({
        to: "/p/$projectId/ai-visibility/prompts/$promptId",
        fuzzy: true,
      }),
    );
  const row = (isActive: boolean) => (
    <SidebarMenuButton
      render={<span />}
      isActive={isActive}
      tooltip={label}
      aria-disabled={placeholder || undefined}
      className={navButtonClass}
    >
      <Icon />
      <span>{label}</span>
    </SidebarMenuButton>
  );
  return (
    <SidebarMenuItem>
      {placeholder ? (
        row(false)
      ) : (
        <Link
          {...linkProps}
          activeOptions={{
            exact: false,
            includeSearch: false,
            ...linkProps.activeOptions,
          }}
          onClick={() => setOpenMobile(false)}
          inactiveProps={
            isPromptHistory || active ? { "aria-current": "page" } : undefined
          }
        >
          {({ isActive }) => row(isActive || isPromptHistory || active)}
        </Link>
      )}
    </SidebarMenuItem>
  );
}

export function Sidebar({
  projectId,
  projectPending,
  ready,
}: {
  projectId: string | null;
  /** No project is known yet, but the projects list may still name one. */
  projectPending: boolean;
  /** The session is confirmed, so the sidebar's own data can load. */
  ready: boolean;
}) {
  // Until a project is known, show the project nav as rows without links, so
  // the sidebar has its full shape from the first paint instead of growing
  // once projects load. The placeholder rows never render these links.
  const navPlaceholder = projectId === null && projectPending;
  const navGroups =
    projectId !== null || navPlaceholder
      ? getProjectNavGroups(projectId ?? "")
      : [connectNavGroup];
  const { pathname } = useLocation();
  const activeGroup = projectId
    ? getProjectNavGroup(projectId, pathname)
    : undefined;
  const { setOpenMobile } = useSidebar();
  // SAM is hidden from navigation: the chat route is only reachable by URL,
  // and while it is open its chat list takes the nav's place.
  const onSamRoute = pathname.includes("/sam");
  const rail = useRail();
  useDesktopShortcut();

  return (
    <UiSidebar variant="inset" collapsible="icon" className="md:!p-0">
      <SidebarHeader className="gap-3 px-3 pb-2 pt-3.5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        {everyApp ? <EveryAppLink /> : null}
        <SidebarBrand />
        <ProjectSwitcher
          activeProjectId={projectId}
          ready={ready}
          compact={rail}
          onCloseDrawer={() => setOpenMobile(false)}
        />
      </SidebarHeader>

      <SidebarContent>
        {onSamRoute && projectId ? (
          ready ? (
            <SamSidebarPanel
              projectId={projectId}
              onNavigate={() => setOpenMobile(false)}
            />
          ) : (
            <div className="px-2 py-1">
              <SamChatListSkeleton />
            </div>
          )
        ) : (
          <nav
            aria-label="Main navigation"
            aria-busy={navPlaceholder || undefined}
          >
            {navGroups.map((group) => {
              const { icon, label: _label, ...linkProps } = group.items[0];
              const active = group.label === activeGroup?.label;
              return (
                <SidebarGroup
                  key={group.label}
                  className="px-3 py-1 group-data-[collapsible=icon]:px-0"
                >
                  <SidebarGroupContent>
                    <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                      <SidebarNavLink
                        icon={icon}
                        label={group.label}
                        linkProps={linkProps}
                        active={active}
                        placeholder={navPlaceholder}
                      />
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })}
          </nav>
        )}
      </SidebarContent>
      <AccountFooter ready={ready} rail={rail} />
      <SidebarRail />
    </UiSidebar>
  );
}

// Behind an Every App gateway, which owns sign-in, organizations, teams and
// billing: the sidebar's first row links back to the gateway, and the footer
// holds help and OpenSEO settings.
const everyApp = isEveryAppClientAuthMode();

/**
 * The way back up, first in the sidebar as in every Every App app. The row
 * keeps its height while the gateway's URL loads so the header doesn't jump.
 */
function EveryAppLink() {
  const accountQuery = useQuery(everyAppAccountQueryOptions());
  const gatewayUrl = accountQuery.data?.gatewayUrl;
  if (!accountQuery.isPending && !gatewayUrl) return null;
  return (
    <a
      href={gatewayUrl ?? undefined}
      aria-label="Back to Every App"
      className={cn(
        "mb-1 inline-flex h-7 w-fit items-center gap-0.5 rounded-md pl-0.5 pr-2 text-sm text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground",
        accountQuery.isPending && "invisible",
      )}
    >
      <ChevronLeft className="size-4" aria-hidden />
      <span>Every App</span>
    </a>
  );
}

function AccountFooter({ ready, rail }: { ready: boolean; rail: boolean }) {
  const { data: session } = useSession();
  const { setOpenMobile } = useSidebar();
  const everyAppAccountQuery = useQuery({
    ...everyAppAccountQueryOptions(),
    enabled: everyApp,
  });
  const email = everyApp
    ? everyAppAccountQuery.data?.email
    : session?.user?.email;
  const [isSwitching, setIsSwitching] = useState(false);
  const orgContextQuery = useQuery({
    ...organizationContextQueryOptions(),
    enabled: Boolean(email) && !everyApp,
  });
  const organizations = everyApp
    ? []
    : (orgContextQuery.data?.organizations ?? []);
  const activeOrganizationId = orgContextQuery.data?.organizationId;

  async function handleSwitchOrganization(organizationId: string) {
    if (isSwitching || organizationId === activeOrganizationId) return;
    setIsSwitching(true);
    try {
      await switchOrganization({ data: { organizationId } });
      // The remembered project belongs to the old workspace; without this,
      // "/" would open it before the access check bounces back.
      clearLastProjectId();
      window.location.assign("/app");
    } catch (error) {
      toast.error(getStandardErrorMessage(error));
      setIsSwitching(false);
    }
  }

  return (
    <UiSidebarFooter className="gap-0 px-3 pb-safe pt-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pb-3">
      <SidebarMenu className="gap-px group-data-[collapsible=icon]:items-center">
        <NotificationsBell /> {/* playbook-seam */}
        <SidebarNavLink
          icon={connectNavGroup.items[0].icon}
          label="Agents"
          linkProps={connectNavGroup.items[0]}
        />
        <SidebarNavLink
          icon={CircleHelp}
          label="Help & Community"
          linkProps={{ to: "/support" }}
        />
        {everyApp ? (
          <SidebarNavLink
            icon={Settings}
            label="Settings"
            linkProps={{ to: "/settings" }}
          />
        ) : email ? (
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    className="mt-1 h-12 gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-active px-2 shadow-[0_1px_2px_rgb(0_0_0/0.04)] hover:bg-sidebar-active data-popup-open:bg-sidebar-active group-data-[collapsible=icon]:mt-2 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:shadow-none"
                    aria-label="Open account menu"
                  />
                }
              >
                <AccountAvatar
                  name={session?.user?.name ?? email}
                  image={session?.user?.image ?? null}
                />
                <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                  <span
                    className="truncate text-[13px] font-medium text-sidebar-foreground"
                    data-ph-mask
                  >
                    {session?.user?.name || email}
                  </span>
                  <span
                    className="truncate text-[11px] text-sidebar-foreground"
                    data-ph-mask
                  >
                    {email}
                  </span>
                </span>
                <Selector className="!size-3.5 text-sidebar-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={rail ? "right" : "top"}
                align={rail ? "end" : "center"}
                className="w-56"
              >
                {organizations.length > 1 ? (
                  <>
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="flex items-center gap-1.5">
                        <ArrowLeftRight className="size-3" />
                        Organization
                      </DropdownMenuLabel>
                      {organizations.map((organization) => (
                        <DropdownMenuItem
                          key={organization.organizationId}
                          disabled={isSwitching}
                          onClick={() =>
                            void handleSwitchOrganization(
                              organization.organizationId,
                            )
                          }
                        >
                          <span className="truncate">
                            {organization.organizationName}
                          </span>
                          {organization.organizationId ===
                          activeOrganizationId ? (
                            <Check className="ml-auto size-4" />
                          ) : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <DropdownMenuItem
                  render={
                    <Link to="/settings" onClick={() => setOpenMobile(false)} />
                  }
                >
                  <Settings className="size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={
                    <Link
                      to={BILLING_ROUTE}
                      onClick={() => setOpenMobile(false)}
                    />
                  }
                >
                  <CreditCard className="size-4" />
                  Billing
                </DropdownMenuItem>
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Theme</DropdownMenuLabel>
                  <div className="px-1 pb-1">
                    <ThemePreferenceRadio />
                  </div>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => signOutAndRedirect()}
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ) : ready ? (
          <SidebarNavLink
            icon={Settings}
            label="Settings"
            linkProps={{ to: "/settings" }}
          />
        ) : (
          // The account row's slot while the session loads.
          <SidebarMenuItem>
            <SidebarMenuSkeleton showIcon />
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </UiSidebarFooter>
  );
}

function AccountAvatar({
  name,
  image,
}: {
  name: string;
  image: string | null;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return image ? (
    <img
      src={image}
      alt=""
      referrerPolicy="no-referrer"
      className="size-8 shrink-0 rounded-full object-cover ring-1 ring-sidebar-border"
    />
  ) : (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#5b8cff] to-[#b06ab3] text-[13px] font-semibold text-white">
      {initial}
    </span>
  );
}
