import { Link, useLocation, useMatchRoute } from "@tanstack/react-router";
import type { LinkOptions } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ComponentType } from "react";
import { toast } from "sonner";
import {
  IconArrowsLeftRight as ArrowLeftRight,
  IconCheck as Check,
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
} from "@/client/navigation/items";
import { ProjectSwitcher } from "@/client/features/projects/ProjectSwitcher";
import {
  SamChatListSkeleton,
  SamSidebarPanel,
} from "@/client/features/sam/SamSidebarPanel";
import { ThemePreferenceRadio } from "@/client/components/ThemePreferenceMenuItems";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { signOutAndRedirect, useSession } from "@/lib/auth-client";
import { BILLING_ROUTE } from "@/shared/billing";
import {
  Sidebar as UiSidebar,
  SidebarContent,
  SidebarFooter as UiSidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
  "h-8 gap-2.5 rounded-lg px-2.5 text-[13px] text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground data-active:bg-sidebar-active data-active:font-medium data-active:text-sidebar-foreground data-active:shadow-[0_1px_2px_rgb(0_0_0/0.06),inset_0_0_0_1px_var(--sidebar-border)] [&_svg]:size-4 [&_svg]:opacity-70 data-active:[&_svg]:opacity-100 hover:[&_svg]:opacity-100";

function SidebarNavLink({
  icon: Icon,
  label,
  linkProps,
  placeholder = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  linkProps: LinkOptions;
  /** Show the row without its link, while its project is still unknown. */
  placeholder?: boolean;
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
            isPromptHistory ? { "aria-current": "page" } : undefined
          }
        >
          {({ isActive }) => row(isActive || isPromptHistory)}
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
  const { setOpenMobile } = useSidebar();
  // SAM is hidden from navigation: the chat route is only reachable by URL,
  // and while it is open its chat list takes the nav's place.
  const onSamRoute = pathname.includes("/sam");
  const rail = useRail();
  useDesktopShortcut();

  return (
    <UiSidebar variant="inset" collapsible="icon" className="md:!p-0">
      <SidebarHeader className="gap-3 px-3 pb-2 pt-3.5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
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
            {navGroups.map((group) => (
              <SidebarGroup
                key={group.label}
                // In the rail, a hairline replaces each group's label.
                className="px-3 py-1.5 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:not-first:mt-1 group-data-[collapsible=icon]:not-first:pt-2.5 group-data-[collapsible=icon]:not-first:before:absolute group-data-[collapsible=icon]:not-first:before:inset-x-4 group-data-[collapsible=icon]:not-first:before:top-0 group-data-[collapsible=icon]:not-first:before:h-px group-data-[collapsible=icon]:not-first:before:bg-sidebar-border"
              >
                <SidebarGroupLabel className="h-7 px-2.5 text-[11px] font-medium text-sidebar-foreground/40">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-px group-data-[collapsible=icon]:items-center">
                    {group.items.map((item) => {
                      const { icon, label, ...linkProps } = item;
                      return (
                        <SidebarNavLink
                          key={linkProps.to}
                          icon={icon}
                          label={label}
                          linkProps={linkProps}
                          placeholder={navPlaceholder}
                        />
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </nav>
        )}
      </SidebarContent>
      <AccountFooter ready={ready} rail={rail} />
      <SidebarRail />
    </UiSidebar>
  );
}

function AccountFooter({ ready, rail }: { ready: boolean; rail: boolean }) {
  const { data: session } = useSession();
  const { setOpenMobile } = useSidebar();
  const email = session?.user?.email;
  const [isSwitching, setIsSwitching] = useState(false);
  const orgContextQuery = useQuery({
    ...organizationContextQueryOptions(),
    enabled: Boolean(email),
  });
  const organizations = orgContextQuery.data?.organizations ?? [];
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
        <SidebarNavLink
          icon={CircleHelp}
          label="Help & Community"
          linkProps={{ to: "/support" }}
        />
        {email ? (
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
                    className="truncate text-[11px] text-sidebar-foreground/50"
                    data-ph-mask
                  >
                    {email}
                  </span>
                </span>
                <Selector className="!size-3.5 text-sidebar-foreground/40" />
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
