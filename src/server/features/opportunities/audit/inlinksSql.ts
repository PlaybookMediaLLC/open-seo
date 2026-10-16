/**
 * RFC-0002 internal links: the pages that link to each target URL, read from
 * the audit scratchpad before finalize destroys it. Plain module (no Workers
 * imports), so tests run the exact query on node:sqlite.
 */

/**
 * Inlinks saved per target. A target at the cap is linked from almost every
 * page, so detection skips it: a missing row there proves nothing.
 */
export const INLINK_CAP = 2_000;

/**
 * Takes a JSON array of target URLs and the per-target source cap. The IN
 * subquery becomes one ephemeral index, so each edge costs one lookup.
 */
export const INLINKS_SQL = `
  SELECT target_url, source_page_id, source_url FROM (
    SELECT j.value AS target_url, p.page_id AS source_page_id, p.url AS source_url,
           ROW_NUMBER() OVER (PARTITION BY j.value ORDER BY p.url) AS n
    FROM page_links p, json_each(p.targets_json) AS j
    WHERE j.value IN (SELECT value FROM json_each(?)) AND p.url != j.value
  )
  WHERE n <= ?
  ORDER BY target_url, source_url
`;

type InlinkRow = {
  target_url: string;
  source_page_id: string;
  source_url: string;
};

export function listInlinks(sql: SqlStorage, targetUrls: string[]) {
  if (!targetUrls.length) return [];
  return sql
    .exec<InlinkRow>(INLINKS_SQL, JSON.stringify(targetUrls), INLINK_CAP)
    .toArray();
}
