// node:sqlite has the same JSON1 and window functions as the scratchpad's
// SQLite, so this runs the exact query the Durable Object runs.
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { SCRATCHPAD_SCHEMA_SQL } from "@/server/features/audit/scratchpad-sql";
import { INLINK_CAP, INLINKS_SQL } from "./inlinksSql";

const url = (path: string) => `https://site.test/${path}`;

function scratchpad(pages: Record<string, string[]>) {
  const db = new DatabaseSync(":memory:");
  db.exec(SCRATCHPAD_SCHEMA_SQL);
  for (const [path, targets] of Object.entries(pages))
    db.prepare(
      "INSERT INTO page_links (page_id, url, targets_json) VALUES (?, ?, ?)",
    ).run(`id-${path}`, url(path), JSON.stringify(targets.map(url)));
  return (targets: string[], cap = INLINK_CAP) =>
    db
      .prepare(INLINKS_SQL)
      .all(JSON.stringify(targets.map(url)), cap)
      .map((row) => [row.target_url, row.source_url]);
}

describe("INLINKS_SQL", () => {
  it("lists the pages that link to each target, without self-links or other targets", () => {
    const inlinks = scratchpad({
      pricing: ["pricing", "blog"],
      blog: ["pricing"],
      about: ["blog"],
    });
    expect(inlinks(["pricing"])).toEqual([[url("pricing"), url("blog")]]);
  });

  it("keeps at most the cap of sources per target", () => {
    const inlinks = scratchpad({
      a: ["target"],
      b: ["target"],
      c: ["target"],
      d: ["other"],
    });
    expect(inlinks(["target", "other"], 2)).toEqual([
      [url("other"), url("d")],
      [url("target"), url("a")],
      [url("target"), url("b")],
    ]);
  });
});
