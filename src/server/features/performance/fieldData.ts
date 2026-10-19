import { sql } from "drizzle-orm";
import { chunk } from "remeda";
import { runBatch } from "@/db/runBatch";
import { cwvSnapshots } from "@/db/schema";
import {
  ga4DateInTimeZone,
  shiftGa4Date,
} from "@/server/features/ga4/services/Ga4Dates";
import { GscService } from "@/server/features/gsc/services/GscService";
import { ProjectContextRepository } from "@/server/features/project-context/repositories/ProjectContextRepository";
import { queryCrux, type FormFactor } from "@/server/lib/crux";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

// RFC-0014 5.2: weekly field data for the origin, the key pages and the
// pages with the most organic clicks, on phones and desktops. At most 70
// requests per project, within the free CrUX quota.
const MAX_REQUESTS = 70;
const TOP_PAGES = 30;
const AT_ONCE = 5;
// D1 binds at most 100 parameters per statement; a snapshot row has 12.
const ROWS_PER_INSERT = 8;
const FORM_FACTORS: FormFactor[] = ["phone", "desktop"];

/** The property's origin: "sc-domain:example.com" or "https://example.com/". */
function originOf(siteUrl: string) {
  const domain = /^sc-domain:(.+)$/.exec(siteUrl)?.[1];
  return domain ? `https://${domain}` : (URL.parse(siteUrl)?.origin ?? null);
}

async function topPages(projectId: string, now: Date) {
  const endDate = shiftGa4Date(
    ga4DateInTimeZone(now, "America/Los_Angeles"),
    -3,
  );
  try {
    const { rows } = await GscService.getPerformance({
      projectId,
      startDate: shiftGa4Date(endDate, -27),
      endDate,
      dimensions: ["page"],
      rowLimit: TOP_PAGES,
      type: "web",
      dataState: "final",
    });
    return rows.flatMap((row) => row.keys?.[0] ?? []);
  } catch {
    // Field data works for the key pages without Search Console.
    return [];
  }
}

/** Every target in priority order: the origin, key pages, top pages. */
async function fieldTargets(projectId: string, now: Date) {
  const [connection, keyPages, pages] = await Promise.all([
    GscService.getConnection(projectId),
    ProjectContextRepository.listKeyPages(projectId),
    topPages(projectId, now),
  ]);
  const origin = connection ? originOf(connection.siteUrl) : null;
  const urls = [...new Set([...keyPages.map((page) => page.url), ...pages])];
  return [
    ...(origin ? [{ scope: "origin" as const, value: origin }] : []),
    ...urls.map((url) => ({ scope: "url" as const, value: url })),
  ].slice(0, MAX_REQUESTS / FORM_FACTORS.length);
}

export async function refreshFieldData(projectId: string, now: Date) {
  const apiKey = await getOptionalEnvValue("CRUX_API_KEY");
  if (!apiKey) return { configured: false, stored: 0, noData: 0, failed: 0 };
  const requests = (await fieldTargets(projectId, now)).flatMap((target) =>
    FORM_FACTORS.map((formFactor) => ({ target, formFactor })),
  );
  const fetchedAt = now.toISOString();
  let noData = 0;
  let failed = 0;
  const rows: Array<typeof cwvSnapshots.$inferInsert> = [];
  for (const group of chunk(requests, AT_ONCE))
    await Promise.all(
      group.map(async ({ target, formFactor }) => {
        try {
          const record = await queryCrux(apiKey, target, formFactor);
          if (!record) return void noData++;
          rows.push({
            ...record,
            id: crypto.randomUUID(),
            projectId,
            scope: target.scope,
            target: target.value,
            formFactor,
            source: "crux",
            fetchedAt,
          });
        } catch {
          failed++;
        }
      }),
    );
  if (rows.length)
    await runBatch((tx) =>
      chunk(rows, ROWS_PER_INSERT).map((values) =>
        tx
          .insert(cwvSnapshots)
          .values(values)
          .onConflictDoUpdate({
            target: [
              cwvSnapshots.projectId,
              cwvSnapshots.scope,
              cwvSnapshots.target,
              cwvSnapshots.formFactor,
              cwvSnapshots.collectionEnd,
              cwvSnapshots.source,
            ],
            set: {
              lcpP75Ms: sql`excluded.lcp_p75_ms`,
              inpP75Ms: sql`excluded.inp_p75_ms`,
              clsP75: sql`excluded.cls_p75`,
              fetchedAt: sql`excluded.fetched_at`,
            },
          }),
      ),
    );
  return { configured: true, stored: rows.length, noData, failed };
}
