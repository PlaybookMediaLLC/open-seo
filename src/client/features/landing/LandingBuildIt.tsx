import type { ReactNode } from "react";
import {
  IconAdjustmentsHorizontal,
  IconChevronDown,
  IconCpu,
  IconFileText,
  IconHome,
  IconRepeat,
  IconSearch,
  IconSettings,
  IconSparkles,
  type Icon,
} from "@tabler/icons-react";
import { cn } from "cn";
import { Eyebrow, Logo, Reveal } from "./LandingPrimitives";

function Point({
  icon: Icon,
  title,
  body,
}: {
  icon: Icon;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-center gap-[14px]">
      <Icon className="size-[30px] shrink-0 text-(--l-text-2)" stroke={1.4} />
      <div className="flex flex-col gap-1">
        <p className="text-[16px] leading-[22.4px] text-(--l-text)">{title}</p>
        <p className="text-[14px] leading-[21px] text-(--l-text-2)">{body}</p>
      </div>
    </div>
  );
}

export function LandingBuildIt() {
  return (
    <section className="z-10 mb-[42px] mt-[88px] flex w-full justify-center overflow-hidden px-6 md:mb-32 md:mt-32 md:h-[531px] md:overflow-visible">
      <Reveal className="relative flex h-full w-full max-w-[950px] flex-col items-center justify-between gap-12 md:mr-[120px] md:flex-row md:items-start md:gap-0">
        <CustomArt />
        <div className="z-10 flex w-full max-w-[374px] shrink-0 flex-col gap-12 md:h-full">
          <div className="flex flex-col gap-2">
            <Eyebrow className="mb-4">Project context</Eyebrow>
            <h2 className="text-[40px] font-medium leading-[44px] text-(--l-text) sm:text-[48px] sm:leading-[51px]">
              Tune it yourself
            </h2>
            <p className="text-[14px] leading-[21px] text-(--l-text-2)">
              Context lets you define how Relay researches, prioritizes and
              reports. Down to the finest detail.
            </p>
          </div>
          <Point
            icon={IconAdjustmentsHorizontal}
            title="Beyond keywords: positioning"
            body="Set goals, audiences and competitors once. Research and reports follow them."
          />
          <Point
            icon={IconCpu}
            title="Pick the right model for the job"
            body="Use Claude, GPT or Gemini through your own agent, or the built-in assistant."
          />
          <Point
            icon={IconRepeat}
            title="Consistent every week"
            body="Saved keywords, tracked ranks and recurring audits keep the signal steady."
          />
        </div>
      </Reveal>
    </section>
  );
}

const SIDEBAR: { label: string; icon: Icon; tile: string; active?: boolean }[] =
  [
    { label: "Home", icon: IconHome, tile: "from-[#3a3a3c] to-[#2c2c2e]" },
    {
      label: "Context",
      icon: IconSparkles,
      tile: "from-[#3a3a3c] to-[#2c2c2e]",
      active: true,
    },
    {
      label: "Keywords",
      icon: IconSearch,
      tile: "from-[#3a3a3c] to-[#2c2c2e]",
    },
    {
      label: "Reports",
      icon: IconFileText,
      tile: "from-[#3a3a3c] to-[#2c2c2e]",
    },
    {
      label: "Settings",
      icon: IconSettings,
      tile: "from-[#3a3a3c] to-[#2c2c2e]",
    },
  ];

const MODELS = [
  { name: "Claude Sonnet 4.5", slug: "claude", bg: "#cc9b7a", fg: "#fff" },
  { name: "GPT-5", slug: "openai", bg: "#10a37f", fg: "#fff" },
  { name: "Gemini 3 Flash", slug: "googlegemini", bg: "#fff", fg: "#4f7df3" },
  { name: "Llama 4", slug: "meta", bg: "#0668e1", fg: "#fff" },
  { name: "Mistral Medium", slug: "mistralai", bg: "#fa500f", fg: "#fff" },
  { name: "DeepSeek V3", slug: "deepseek", bg: "#4d6bfe", fg: "#fff" },
] as const;

function ModelTile({ model }: { model: (typeof MODELS)[number] }) {
  return (
    <span
      className="grid size-4 shrink-0 place-items-center rounded-[4px]"
      style={{ background: model.bg }}
    >
      <Logo slug={model.slug} color={model.fg} className="size-[10px]" />
    </span>
  );
}

/** superwhisper's layered settings windows, tilted and shaded into the dark. */
function CustomArt() {
  const [favorite, ...popular] = MODELS;
  return (
    <div
      aria-hidden
      className="landing-custom-art relative h-[360px] w-[400px] shrink-0 select-none overflow-y-clip md:mt-[70px] md:h-full"
    >
      <div className="landing-custom-shade pointer-events-none absolute inset-0 z-[100]" />
      <div className="pointer-events-none absolute inset-0 z-[101] bg-gradient-to-t from-black to-transparent to-30% md:hidden" />

      {/* The main app window, half lost in shadow. */}
      <div className="absolute -left-[140px] top-5 h-[380px] w-[500px] rounded-[18px] opacity-80">
        <div className="absolute inset-0 rounded-[18px] bg-[#1a1a1a] shadow-[0_0_0_1px_rgb(0_0_0/0.3),0_16px_48px_0_rgb(0_0_0/0.35)]" />
        <div className="absolute inset-0 rounded-[18px] bg-gradient-to-l from-white to-black mix-blend-multiply" />
        <div className="absolute inset-0 rounded-[18px] border border-white/[0.03]" />
        <div className="absolute inset-0 rounded-[18px] bg-gradient-to-l from-black/50 to-transparent" />
        <div className="absolute bottom-px left-0 top-px w-[140px] border-r border-white/[0.08] opacity-20">
          <div className="flex h-9 items-center gap-1.5 px-3">
            <span className="size-2.5 rounded-full bg-white/20" />
            <span className="size-2.5 rounded-full bg-white/20" />
            <span className="size-2.5 rounded-full bg-white/20" />
          </div>
          <div className="flex flex-col gap-0.5 p-1.5">
            {SIDEBAR.map(({ label, icon: ItemIcon, tile, active }) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-1.5 py-[5px]",
                  active && "bg-white/[0.06]",
                )}
              >
                <span
                  className={cn(
                    "grid size-[18px] place-items-center rounded-[4px] bg-gradient-to-b",
                    tile,
                  )}
                >
                  <ItemIcon className="size-[11px] text-white" stroke={2.2} />
                </span>
                <span
                  className={cn(
                    "text-[10px]",
                    active ? "font-medium text-white/85" : "text-white/55",
                  )}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute left-[140px] top-9 p-3 opacity-40">
          <p className="mb-1.5 text-[10px] font-semibold text-white/85">
            Context
          </p>
          <p className="mb-3 w-[200px] text-[8px] leading-[1.4] text-white/50">
            Tell Relay what you sell, who buys it and who you compete with.
            Every answer follows it.
          </p>
          <div className="w-[220px] rounded-lg border border-white/[0.08] bg-white/[0.04]">
            <p className="border-b border-white/[0.08] px-2.5 py-2 text-[9px] font-medium text-white">
              acme-demo.com
            </p>
            <p className="px-2.5 py-2 text-[8px] text-white/55">
              Goal · Audience · Rivals
            </p>
          </div>
        </div>
      </div>

      {/* The settings sheet in front of it. */}
      <div className="absolute left-[90px] top-[50px] z-50 h-[340px] w-[300px] rounded-r-[12px] border border-white/10 bg-[rgb(28_28_28/0.85)] shadow-[0_7px_22px_0_rgb(0_0_0/0.25)]">
        <div className="flex h-9 items-center justify-between border-b border-white/[0.08] px-3">
          <span className="text-[10px] text-white/55">❮</span>
          <span className="text-[11px] font-medium text-white/90">
            Project settings
          </span>
          <span className="w-2.5" />
        </div>
        <div className="p-3.5">
          <SettingRow label="Assistant">
            <ModelPick />
          </SettingRow>
          <SettingRow label="Market">
            <Select label="United States · Google" />
          </SettingRow>
          <SettingRow label="Audience">
            <Select label="B2B marketers" />
          </SettingRow>
          <p className="mb-2.5 text-[10px] font-medium text-white/85">
            Send reports to
          </p>
          <div className="flex items-center gap-2">
            <span className="flex flex-col items-center gap-1">
              <span className="grid size-8 place-items-center rounded-lg border border-dashed border-white/20 bg-white/[0.03] text-[14px] text-white/30">
                +
              </span>
              <span className="text-[7px] text-white/50">Add app</span>
            </span>
            {[
              ["notion", "Notion", "#fff", "#000"],
              ["gmail", "Gmail", "#fff", "#ea4335"],
              ["linear", "Linear", "#5e6ad2", "#fff"],
            ].map(([slug, name, bg, fg]) => (
              <span key={slug} className="flex flex-col items-center gap-1">
                <span
                  className="grid size-8 place-items-center rounded-lg"
                  style={{ background: bg }}
                >
                  <Logo slug={slug} color={fg} className="size-[18px]" />
                </span>
                <span className="text-[7px] text-white/50">{name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* The open model menu. */}
      <div className="absolute left-[230px] top-[135px] z-[115]">
        <div className="landing-dropdown h-[190px] w-[175px] overflow-hidden">
          <p className="px-2 py-1 text-[9px] font-semibold text-white/50">
            Favorites
          </p>
          <ModelRow model={favorite} selected />
          <p className="mt-1 px-2 py-1 text-[9px] font-semibold text-white/50">
            Most popular
          </p>
          {popular.map((model) => (
            <ModelRow key={model.name} model={model} />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-l from-black/50 to-transparent" />
      </div>
    </div>
  );
}

function ModelRow({
  model,
  selected,
}: {
  model: (typeof MODELS)[number];
  selected?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-0.5 flex items-center gap-1.5 rounded-[5px] px-1.5 py-1 text-[10px] font-medium text-white/95",
        selected && "bg-white/[0.06]",
      )}
    >
      <ModelTile model={model} />
      {model.name}
    </div>
  );
}

function ModelPick() {
  const [first] = MODELS;
  return (
    <span className="flex h-7 flex-1 items-center justify-between rounded-md border border-white/[0.12] bg-white/[0.06] px-2">
      <span className="flex items-center gap-1.5 text-[9px] text-white">
        <ModelTile model={first} />
        {first.name}
      </span>
      <IconChevronDown className="size-2.5 text-white/40" />
    </span>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3.5 flex items-center gap-2">
      <span className="w-[42%] text-[10px] font-medium text-white/85">
        {label}
      </span>
      {children}
    </div>
  );
}

function Select({ label }: { label: string }) {
  return (
    <span className="flex h-7 flex-1 items-center justify-between rounded-md border border-white/[0.12] bg-white/[0.06] px-2 text-[9px] text-white">
      {label}
      <IconChevronDown className="size-2.5 text-white/40" />
    </span>
  );
}

/** App keys, as [simple-icons slug, tile colour, glyph colour]. */
