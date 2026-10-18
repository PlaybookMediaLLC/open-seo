import { NavTab, NavTabs } from "@/client/components/NavTabs";

const tabs = [
  { to: "/p/$projectId/settings" as const, label: "General", exact: true },
  { to: "/p/$projectId/settings/integrations" as const, label: "Integrations" },
  { to: "/p/$projectId/settings/automation" as const, label: "Automation" }, // playbook-seam
  { to: "/p/$projectId/settings/spending" as const, label: "Spending" }, // playbook-seam
  { to: "/p/$projectId/settings/seo-checks" as const, label: "SEO checks" }, // playbook-seam
];

export function SettingsTabs({ projectId }: { projectId: string }) {
  return (
    <NavTabs label="Project settings sections">
      {tabs.map((tab) => (
        <NavTab
          key={tab.to}
          to={tab.to}
          params={{ projectId }}
          activeOptions={{ exact: tab.exact ?? false }}
        >
          {tab.label}
        </NavTab>
      ))}
    </NavTabs>
  );
}
