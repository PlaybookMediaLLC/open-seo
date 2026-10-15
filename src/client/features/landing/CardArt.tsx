import { cn } from "cn";

/** A compact "opportunity" row, as the app renders it. */
export function OpportunityArt() {
  return (
    <div className="w-[250px] space-y-1.5">
      {[
        ["/pricing", "+640", true],
        ["/blog/seo-audit", "+310", false],
        ["/features", "+190", false],
      ].map(([page, gain, strong]) => (
        <div
          key={String(page)}
          className="flex items-center justify-between rounded-lg border border-white/10 bg-[#141317]/90 px-3 py-2 backdrop-blur"
        >
          <span className="font-mono text-[10.5px] text-white/70">{page}</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              strong
                ? "bg-[#dd55e7]/20 text-[#f0a8f6]"
                : "bg-white/10 text-white/60",
            )}
          >
            {gain}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Before/after bars with a lift readout, as on an experiment. */
export function ExperimentArt() {
  return (
    <div className="w-[230px] rounded-xl border border-white/10 bg-[#0b1512]/90 p-4 backdrop-blur">
      <div className="flex h-20 items-end gap-5">
        {[
          ["Before", 34, "#ffffff26"],
          ["After", 82, "#1cecbb"],
        ].map(([label, height, color]) => (
          <div
            key={String(label)}
            className="flex h-full flex-1 flex-col justify-end text-center"
          >
            <span
              className="w-full rounded-t"
              style={{
                height: `${Number(height)}%`,
                background: String(color),
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-5 text-center text-[9.5px] text-white/45">
        <span className="flex-1">Before</span>
        <span className="flex-1">After</span>
      </div>
      <p className="mt-1.5 text-center text-[11px] font-medium text-[#1cecbb]">
        +126% clicks
      </p>
    </div>
  );
}

/** A unified diff on a metadata change. */
export function DiffArt() {
  return (
    <div className="w-[250px] overflow-hidden rounded-xl border border-white/10 bg-[#140707]/90 backdrop-blur">
      <p className="border-b border-white/10 px-3 py-1.5 font-mono text-[10px] text-white/45">
        app/pricing/page.tsx
      </p>
      <div className="space-y-0.5 p-3 font-mono text-[10px] leading-4">
        <p className="text-[#ff7b72]">- title: “Pricing”</p>
        <p className="text-[#3fb950]">+ title: “Pricing · Plans from $0”</p>
        <p className="text-[#ff7b72]">- description: (missing)</p>
        <p className="text-[#3fb950]">+ description: “Rank tracking…”</p>
      </div>
    </div>
  );
}

/** Who gets cited for a prompt, as Prompt Tracking shows it. */
export function CitationArt() {
  return (
    <div className="w-[250px] rounded-xl border border-white/10 bg-[#07101f]/90 p-3 backdrop-blur">
      <p className="text-[10px] text-white/45">“best seo tools for startups”</p>
      <div className="mt-2 space-y-1.5">
        {[
          ["openseo.com", 72, "#0088ff"],
          ["semrush.com", 48, "#4b6b8f"],
          ["ahrefs.com", 31, "#3a4f68"],
        ].map(([site, pct, color]) => (
          <div key={String(site)} className="flex items-center gap-2">
            <span className="w-[72px] shrink-0 text-[10px] text-white/70">
              {site}
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full rounded-full"
                style={{ width: `${Number(pct)}%`, background: String(color) }}
              />
            </span>
            <span className="w-7 text-right text-[9.5px] text-white/45">
              {pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The Search Console clicks curve. */
export function SearchConsoleArt() {
  const series = [22, 28, 25, 36, 33, 48, 44, 60, 66, 62, 78, 92];
  const path = series
    .map(
      (value, index) =>
        `${index === 0 ? "M" : "L"}${index * 20} ${100 - value}`,
    )
    .join(" ");
  return (
    <div className="w-[240px] rounded-xl border border-white/10 bg-[#07140c]/90 p-3 backdrop-blur">
      <p className="text-[10px] text-white/45">Clicks · last 28 days</p>
      <p className="text-[17px] font-semibold tracking-[-0.4px] text-white">
        12,480 <span className="text-[11px] text-[#17c253]">+38%</span>
      </p>
      <svg viewBox="0 0 220 100" className="mt-1 h-14 w-full" aria-hidden>
        <path d={`${path} L220 100 L0 100Z`} fill="#17c253" opacity="0.15" />
        <path d={path} fill="none" stroke="#17c253" strokeWidth="2.5" />
      </svg>
    </div>
  );
}

/** The project context fields. */
export function ContextArt() {
  return (
    <div className="w-[240px] space-y-1.5 rounded-xl border border-white/10 bg-[#14110a]/90 p-3 backdrop-blur">
      {[
        ["Goal", "Grow demo signups"],
        ["Audience", "B2B marketers"],
        ["Rivals", "semrush, ahrefs"],
        ["Tone", "Plain, concrete"],
      ].map(([key, value]) => (
        <div
          key={key}
          className="flex items-center justify-between rounded-md bg-white/[0.06] px-2.5 py-1.5"
        >
          <span className="text-[10px] text-white/45">{key}</span>
          <span className="text-[10px] text-white/85">{value}</span>
        </div>
      ))}
    </div>
  );
}
