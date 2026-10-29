import { sortBy } from "remeda";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { ProjectContextRepository } from "@/server/features/project-context/repositories/ProjectContextRepository";
import { pageTraffic } from "@/server/features/seo-checks/pageTraffic";
import { AppError } from "@/server/lib/errors";
import { MAX_MONITORED_PAGES } from "@/shared/protection";
import type { saveMonitoredPagesInputSchema } from "@/types/schemas/protection";
import type { z } from "zod";
import {
  audit,
  conflict,
  fenced,
  MANAGE,
  requireEnrollment,
  type ProtectionContext,
} from "./protectionAccess";
import { ProtectionRepository } from "./repositories/ProtectionRepository";

// RFC-0026 phase A (IRFC-0001): the agreed page set, changed behind the
// enrollment's scope fence.
const KEY_PAGE_RANK = { money: 0, hub: 1, spoke: 2, other: 2 } as const;

/** The page's path on the origin; null for another origin, a query or a fragment. */
function pathOn(origin: string, input: string): string | null {
  if (input.includes("?") || input.includes("#")) return null;
  const url = URL.parse(input, origin);
  if (!url || url.origin !== origin) return null;
  return url.pathname.replace(/\/+$/, "") || "/";
}

export async function suggestPages(context: ProtectionContext) {
  const enrollment = await requireEnrollment(context.project.id);
  const [keyPages, traffic, pages] = await Promise.all([
    ProjectContextRepository.listKeyPages(context.project.id),
    pageTraffic(context.project.id),
    ProtectionRepository.listPages(enrollment.id),
  ]);
  const taken = new Set(pages.map((page) => page.path));
  const suggestions: Array<{
    path: string;
    selectionReason: "key_page" | "top_traffic";
  }> = [];
  const suggest = (
    url: string,
    selectionReason: "key_page" | "top_traffic",
  ) => {
    const path = pathOn(enrollment.productionOrigin, url);
    if (path === null || taken.has(path)) return;
    taken.add(path);
    suggestions.push({ path, selectionReason });
  };
  for (const page of sortBy(keyPages, (row) => KEY_PAGE_RANK[row.role]))
    suggest(page.url, "key_page");
  for (const page of sortBy(traffic, [(row) => row.clicks, "desc"]))
    suggest(page.url, "top_traffic");
  return suggestions.slice(0, MAX_MONITORED_PAGES);
}

export async function savePages(
  context: ProtectionContext,
  input: Omit<z.infer<typeof saveMonitoredPagesInputSchema>, "projectId">,
): Promise<void> {
  requireOrgPermission(context, MANAGE);
  const projectId = context.project.id;
  const enrollment = await requireEnrollment(projectId);
  if (enrollment.scopeVersion !== input.expectedScopeVersion) throw conflict();
  const pages = await ProtectionRepository.listPages(enrollment.id);
  const pageIds = new Set(pages.map((page) => page.id));
  const named = [
    ...input.remove,
    ...input.exclude.map((page) => page.pageId),
    ...input.include,
  ];
  if (
    named.some((pageId) => !pageIds.has(pageId)) ||
    new Set(named).size !== named.length
  )
    throw new AppError(
      "VALIDATION_ERROR",
      "Each change must name a current page, once.",
    );
  const removed = new Set(input.remove);
  const excluded = new Set(input.exclude.map((page) => page.pageId));
  const included = new Set(input.include);
  const kept = pages.filter((page) => !removed.has(page.id));
  const paths = new Set(kept.map((page) => page.path));
  const add = input.add.map((page) => {
    const path = pathOn(enrollment.productionOrigin, page.path);
    if (path === null)
      throw new AppError(
        "VALIDATION_ERROR",
        "Pages must be paths on the production origin, with no query or fragment.",
      );
    if (paths.has(path))
      throw new AppError("VALIDATION_ERROR", `${path} is already in scope.`);
    paths.add(path);
    return { path, selectionReason: page.selectionReason };
  });
  const checked =
    kept.filter(
      (page) =>
        included.has(page.id) ||
        (!excluded.has(page.id) && !page.excludedReason),
    ).length + add.length;
  if (checked > MAX_MONITORED_PAGES)
    throw new AppError(
      "VALIDATION_ERROR",
      `Protect at most ${MAX_MONITORED_PAGES} pages.`,
    );
  if (!named.length && !add.length) return;
  const summary = Object.entries({
    added: add.length,
    removed: removed.size,
    excluded: excluded.size,
    included: included.size,
  })
    .filter(([, count]) => count > 0)
    .map(([verb, count]) => `${count} ${verb}`)
    .join(", ");
  await fenced(projectId, enrollment, () =>
    ProtectionRepository.savePages({
      enrollmentId: enrollment.id,
      projectId,
      scopeVersion: enrollment.scopeVersion + 1,
      userId: context.userId,
      add,
      remove: input.remove,
      exclude: input.exclude,
      include: input.include,
      audit: audit(
        context,
        enrollment.id,
        "protection.pages_changed",
        `Protected pages: ${summary}`,
      ),
    }),
  );
}
