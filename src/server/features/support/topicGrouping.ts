import { sort } from "remeda";
import { docsTokens } from "@/server/features/docs/docsDetectors";

// RFC-0017 5.4 steps 4 and 5: tickets join the topic whose mean embedding is
// the most similar, at a fixed cosine threshold, in time order.
// ponytail: one greedy pass; a re-clustering pass if topics drift.
const THRESHOLD = 0.6;
const LABEL_TERMS = 3;
const MIN_SHARED = 2;

type Ticket = { title: string; createdAt: string; vector: number[] };
type Topic = { tickets: Ticket[]; centroid: number[] };

const cosine = (a: number[], b: number[]) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index++) {
    dot += a[index] * (b[index] ?? 0);
    normA += a[index] ** 2;
    normB += (b[index] ?? 0) ** 2;
  }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
};

export function groupTickets(tickets: Ticket[]) {
  const topics: Topic[] = [];
  for (const ticket of sort(tickets, (a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )) {
    let best: Topic | null = null;
    let bestScore = THRESHOLD;
    for (const topic of topics) {
      const score = cosine(ticket.vector, topic.centroid);
      if (score >= bestScore) [best, bestScore] = [topic, score];
    }
    if (!best) {
      topics.push({ tickets: [ticket], centroid: [...ticket.vector] });
      continue;
    }
    const size = best.tickets.length;
    best.centroid = best.centroid.map(
      (value, index) =>
        (value * size + (ticket.vector[index] ?? 0)) / (size + 1),
    );
    best.tickets.push(ticket);
  }
  return topics;
}

/**
 * The most common words of the topic's ticket titles: stems to match docs
 * pages, and each stem's most common written form for the label.
 */
export function topicTerms(titles: string[]) {
  const counts = new Map<
    string,
    { count: number; forms: Map<string, number> }
  >();
  for (const title of titles)
    for (const word of title
      .replace(/\[(?:name|email|phone|url)\]/g, " ")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)) {
      const [stem] = [...docsTokens(word)];
      if (!stem || !/\p{L}/u.test(stem)) continue;
      const entry = counts.get(stem) ?? { count: 0, forms: new Map() };
      entry.count++;
      entry.forms.set(word, (entry.forms.get(word) ?? 0) + 1);
      counts.set(stem, entry);
    }
  const top = sort(
    [...counts],
    ([a, x], [b, y]) => y.count - x.count || a.localeCompare(b),
  ).slice(0, LABEL_TERMS);
  return {
    stems: top.map(([stem]) => stem),
    label: top
      .map(
        ([, entry]) => sort([...entry.forms], ([, x], [, y]) => y - x)[0]?.[0],
      )
      .join(" "),
  };
}

/** The docs page whose title and headings share the most topic words. */
export function bestDocsPage(
  terms: string[],
  pages: Array<{ id: string; texts: string[] }>,
) {
  let best: { id: string; shared: number } | null = null;
  for (const page of pages) {
    const words = new Set(page.texts.flatMap((text) => [...docsTokens(text)]));
    const shared = terms.filter((term) => words.has(term)).length;
    if (
      shared >= Math.min(MIN_SHARED, terms.length) &&
      shared > (best?.shared ?? 0)
    )
      best = { id: page.id, shared };
  }
  return best?.id ?? null;
}
