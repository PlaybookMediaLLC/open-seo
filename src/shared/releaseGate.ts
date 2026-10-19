import { z } from "zod";

// RFC-0015 5.4: relay-gate.json, the release gate settings that live in the
// repository and are reviewed like code. Project settings give the
// defaults; the file wins.
export const GATE_PACKS = [
  "seo",
  "accessibility",
  "links",
  "security",
  "performance",
] as const;
export type GatePack = (typeof GATE_PACKS)[number];

const percent = z.number().min(0).max(1_000);
const gateConfigSchema = z
  .object({
    packs: z
      .object({
        seo: z.boolean(),
        accessibility: z.boolean(),
        links: z.boolean(),
        securityHeaders: z.boolean(),
        performance: z.boolean(),
      })
      .partial()
      .strict()
      .default({}),
    budgets: z
      .object({
        lcpWorsePercent: percent,
        tbtWorsePercent: percent,
        clsWorsePercent: percent,
        jsGrowthPercent: percent,
        imageMaxKb: z.number().int().min(1).max(100_000),
      })
      .partial()
      .strict()
      .default({}),
    ignore: z
      .array(
        z
          .object({
            rule: z.string().min(1).max(100),
            path: z
              .string()
              .min(1)
              .max(300)
              .refine((pattern) => {
                try {
                  return RegExp(pattern) instanceof RegExp;
                } catch {
                  return false;
                }
              }, "Use a valid regular expression."),
          })
          .strict(),
      )
      .max(100)
      .default([]),
  })
  .strict();
type GateConfig = z.infer<typeof gateConfigSchema>;

export const DEFAULT_BUDGETS = {
  lcpWorsePercent: 20,
  tbtWorsePercent: 20,
  clsWorsePercent: 20,
  jsGrowthPercent: 10,
  imageMaxKb: 300,
};

/** The file's settings, or the exact reason it is invalid. */
export function parseGateConfig(
  text: string,
): { config: GateConfig } | { error: string } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { error: "relay-gate.json is not valid JSON." };
  }
  const parsed = gateConfigSchema.safeParse(value);
  return parsed.success
    ? { config: parsed.data }
    : {
        error: `relay-gate.json is invalid: ${parsed.error.issues
          .map(
            (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
          )
          .join("; ")}`,
      };
}

const PACK_NAMES: Record<GatePack, string> = {
  seo: "SEO",
  accessibility: "Accessibility",
  links: "Links and assets",
  security: "Security headers",
  performance: "Performance",
};

/**
 * RFC-0015: the findings of a run in Markdown, grouped by pack, with the
 * ignore rules that relay-gate.json applied.
 */
export function gateSummary(
  findings: Array<{
    pack: GatePack;
    severity: "blocking" | "warning";
    path: string;
    rule: string;
  }>,
  fileIgnores: Array<{ rule: string; path: string }>,
) {
  const sections = GATE_PACKS.flatMap((pack) => {
    const items = findings.filter((finding) => finding.pack === pack);
    return items.length
      ? [
          `### ${PACK_NAMES[pack]}\n\n${items.map((finding) => `- **${finding.severity}** ${finding.path}: ${finding.rule}`).join("\n")}`,
        ]
      : [];
  });
  return [
    ...sections,
    ...(fileIgnores.length
      ? [
          `### Ignored by relay-gate.json\n\n${fileIgnores.map((ignore) => `- ${ignore.rule} on paths matching \`${ignore.path}\``).join("\n")}`,
        ]
      : []),
  ].join("\n\n");
}

/** The packs a run uses: the project's defaults, then the file. */
export function enabledPacks(
  defaults: Record<GatePack, boolean>,
  config: GateConfig | null,
): GatePack[] {
  const file = config?.packs ?? {};
  const value: Record<GatePack, boolean> = {
    seo: file.seo ?? defaults.seo,
    accessibility: file.accessibility ?? defaults.accessibility,
    links: file.links ?? defaults.links,
    security: file.securityHeaders ?? defaults.security,
    performance: file.performance ?? defaults.performance,
  };
  return GATE_PACKS.filter((pack) => value[pack]);
}
