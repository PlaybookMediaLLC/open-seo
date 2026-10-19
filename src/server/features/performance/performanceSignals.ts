import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLighthouseResults,
  auditPages,
  audits,
  cwvSnapshots,
} from "@/db/schema";
import { readStoredLighthousePayload } from "@/server/lib/lighthousePayload";
import { getJsonFromR2 } from "@/server/lib/r2";
import { causesFor, type PerformanceCause } from "@/shared/performance";

// RFC-0014 5.3 and 5.4: the newest field data of each target, and the causes
// that the newest audit's Lighthouse reports name.
const FIELD_MAX_AGE_DAYS = 35;
const LAB_MAX_AGE_DAYS = 30;

export type FieldSnapshot = {
  scope: "url" | "origin";
  target: string;
  formFactor: "phone" | "desktop";
  collectionEnd: string;
  lcpP75Ms: number | null;
  inpP75Ms: number | null;
  clsP75: number | null;
};
export type LabPage = {
  url: string;
  strategy: "mobile" | "desktop";
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  causes: PerformanceCause[];
};
export type PerformanceSignals = { field: FieldSnapshot[]; lab: LabPage[] };

const daysBefore = (now: Date, days: number) =>
  new Date(now.getTime() - days * 86_400_000).toISOString();

/** Null when the project has no recent field data. */
export async function loadPerformanceSignals(
  projectId: string,
  now = new Date(),
): Promise<PerformanceSignals | null> {
  const rows = await db
    .select({
      scope: cwvSnapshots.scope,
      target: cwvSnapshots.target,
      formFactor: cwvSnapshots.formFactor,
      collectionEnd: cwvSnapshots.collectionEnd,
      lcpP75Ms: cwvSnapshots.lcpP75Ms,
      inpP75Ms: cwvSnapshots.inpP75Ms,
      clsP75: cwvSnapshots.clsP75,
    })
    .from(cwvSnapshots)
    .where(
      and(
        eq(cwvSnapshots.projectId, projectId),
        eq(cwvSnapshots.source, "crux"),
        gte(
          cwvSnapshots.collectionEnd,
          daysBefore(now, FIELD_MAX_AGE_DAYS).slice(0, 10),
        ),
      ),
    )
    .orderBy(desc(cwvSnapshots.collectionEnd));
  const newest = new Map<string, FieldSnapshot>();
  for (const row of rows) {
    const key = `${row.scope} ${row.target} ${row.formFactor}`;
    if (!newest.has(key)) newest.set(key, row);
  }
  if (!newest.size) return null;
  const reports = await db
    .select({
      auditId: audits.id,
      url: auditPages.url,
      strategy: auditLighthouseResults.strategy,
      lcpMs: auditLighthouseResults.lcpMs,
      inpMs: auditLighthouseResults.inpMs,
      cls: auditLighthouseResults.cls,
      r2Key: auditLighthouseResults.r2Key,
    })
    .from(auditLighthouseResults)
    .innerJoin(audits, eq(audits.id, auditLighthouseResults.auditId))
    .innerJoin(auditPages, eq(auditPages.id, auditLighthouseResults.pageId))
    .where(
      and(
        eq(audits.projectId, projectId),
        isNotNull(auditLighthouseResults.r2Key),
        gte(audits.startedAt, daysBefore(now, LAB_MAX_AGE_DAYS)),
      ),
    )
    .orderBy(desc(audits.startedAt));
  const auditId = reports[0]?.auditId;
  const lab = await Promise.all(
    reports
      .filter((report) => report.auditId === auditId)
      .map(async ({ auditId: _auditId, r2Key, ...page }) => {
        try {
          const { report } = readStoredLighthousePayload(
            await getJsonFromR2(r2Key ?? ""),
          );
          return {
            ...page,
            causes: causesFor(report.issues.map((issue) => issue.auditKey)),
          };
        } catch {
          // A missing or unreadable report names no cause.
          return { ...page, causes: [] };
        }
      }),
  );
  return { field: [...newest.values()], lab };
}
