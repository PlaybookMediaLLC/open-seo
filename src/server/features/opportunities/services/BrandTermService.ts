import type { z } from "zod";
import {
  brandTermsSchema,
  type BRAND_TERM_AUTHORS,
  type BrandTerms,
} from "@/types/schemas/opportunities";
import { BrandTermRepository } from "../repositories/BrandTermRepository";

/** The first label of the project domain, for example eigenn from eigenn.io. */
function domainTerm(domain: string | null): string | null {
  const label = domain?.replace(/^www\./, "").split(".")[0] ?? "";
  return label.length >= 2 && label.length <= 60 ? label : null;
}

async function get(projectId: string): Promise<BrandTerms> {
  const { terms, domain } = await BrandTermRepository.list(projectId);
  if (terms.length) return { terms, source: "saved" };
  const seed = domainTerm(domain);
  return seed
    ? { terms: [seed], source: "domain" }
    : { terms: [], source: "none" };
}

/** Replaces the saved terms. Undefined means no change. */
async function save(
  projectId: string,
  terms: z.output<typeof brandTermsSchema> | undefined,
  author: (typeof BRAND_TERM_AUTHORS)[number],
): Promise<void> {
  if (terms) await BrandTermRepository.replace(projectId, terms, author);
}

function render(brandTerms: BrandTerms): string {
  const terms = brandTerms.terms.join(", ") || "none";
  return `\n\n## Brand terms\n\n${terms}${brandTerms.source === "domain" ? " (from the project domain; save terms to replace it)" : ""}. Opportunity detection leaves out queries with these words.`;
}

export const BrandTermService = { get, save, render };

/** MCP field: the full list replaces the saved terms. */
export const brandTermsToolField = brandTermsSchema
  .optional()
  .describe(
    "Optional. The full list of brand terms (lowercase words, at most 20). It replaces the saved list. Opportunity detection treats a query that contains a brand term as branded.",
  );
