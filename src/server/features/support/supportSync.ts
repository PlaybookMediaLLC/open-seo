import { and, eq } from "drizzle-orm";
import { reverse } from "remeda";
import { z } from "zod";
import { db } from "@/db";
import {
  docsPageHeadings,
  docsPages,
  supportSources,
  supportTopicExcerpts,
  supportTopics,
} from "@/db/schema";
import { runBatch } from "@/db/runBatch";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { connectedGithub } from "@/server/features/publishing/publishingAccess";
import { PublishingRepository } from "@/server/features/publishing/repositories/PublishingRepository";
import { AppError } from "@/server/lib/errors";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import { redact } from "./redact";
import { embedTexts } from "./supportEmbeddings";
import { bestDocsPage, groupTickets, topicTerms } from "./topicGrouping";

// RFC-0017 5.4: the last 90 days of GitHub issues become counted topics. The
// subject and first message are read, redacted, embedded and grouped in
// memory; only labels, counts and 3 redacted excerpts per topic are stored.
const DAYS = 90;
const DAY_MS = 86_400_000;
const PAGES = 5;
const MESSAGE_CHARS = 1_000;
const EXCERPTS = 3;
const EXCERPT_CHARS = 200;
// D1 allows about 100 bound parameters a statement; an excerpt row has 5.
const EXCERPT_ROWS = 18;

const issuesSchema = z.array(
  z.object({
    title: z.string(),
    body: z.string().nullable().optional(),
    created_at: z.string(),
    user: z.object({ login: z.string() }).nullable(),
    pull_request: z.unknown().optional(),
  }),
);

/** The server switch: off until the privacy policy covers ticket text. */
export async function supportTopicsEnabled() {
  return (await getOptionalEnvValue("RELAY_SUPPORT_TOPICS"))?.trim() === "on";
}

export async function processSupportTickets(
  projectId: string,
  now: Date,
  customer: BillingCustomerContext,
) {
  if (!(await supportTopicsEnabled())) return { status: "off" as const };
  const [source] = await db
    .select({ id: supportSources.id })
    .from(supportSources)
    .where(eq(supportSources.projectId, projectId));
  if (!source) return { status: "not_connected" as const };
  const connection = await PublishingRepository.getConnection(projectId);
  if (!connection)
    throw new AppError("CONFLICT", "Connect the repository first.");
  const client = await connectedGithub(
    connection,
    AbortSignal.timeout(90_000),
    { metadata: "read", issues: "read" },
    PAGES + 2,
  );
  const since = new Date(now.getTime() - DAYS * DAY_MS).toISOString();
  const tickets = [];
  for (let page = 1; page <= PAGES; page++) {
    const issues = await client.request(
      `/issues?state=all&sort=created&direction=desc&per_page=100&page=${page}&since=${encodeURIComponent(since)}`,
      issuesSchema,
    );
    for (const issue of issues)
      if (issue.pull_request === undefined && issue.created_at >= since) {
        const names = issue.user ? [issue.user.login] : [];
        tickets.push({
          createdAt: issue.created_at,
          title: redact(issue.title, names),
          message: redact((issue.body ?? "").slice(0, MESSAGE_CHARS), names),
        });
      }
    if (issues.length < 100) break;
  }
  const vectors = await embedTexts(
    customer,
    tickets.map((ticket) => `${ticket.title}\n${ticket.message}`),
  );
  const topics = groupTickets(
    tickets.map((ticket, index) => ({
      title: ticket.title,
      createdAt: ticket.createdAt,
      vector: vectors[index] ?? [],
    })),
  );
  const [pages, headings] = await Promise.all([
    db
      .select({ id: docsPages.id, title: docsPages.title })
      .from(docsPages)
      .where(eq(docsPages.projectId, projectId)),
    db
      .select({ pageId: docsPageHeadings.pageId, text: docsPageHeadings.text })
      .from(docsPageHeadings)
      .where(eq(docsPageHeadings.projectId, projectId)),
  ]);
  const docs = pages.map((page) => ({
    id: page.id,
    texts: [
      page.title ?? "",
      ...headings
        .filter((heading) => heading.pageId === page.id)
        .map((heading) => heading.text),
    ],
  }));
  const recent = new Date(now.getTime() - 28 * DAY_MS).toISOString();
  const previous = new Date(now.getTime() - 56 * DAY_MS).toISOString();
  const updatedAt = now.toISOString();
  const rows = topics.map((topic) => {
    const terms = topicTerms(topic.tickets.map((ticket) => ticket.title));
    const id = crypto.randomUUID();
    return {
      topic: {
        id,
        projectId,
        label: terms.label || "other",
        ticketCount28d: topic.tickets.filter((t) => t.createdAt >= recent)
          .length,
        ticketCountPrev28d: topic.tickets.filter(
          (t) => t.createdAt >= previous && t.createdAt < recent,
        ).length,
        docsPageId: bestDocsPage(terms.stems, docs),
        updatedAt,
      },
      excerpts: reverse(topic.tickets.slice(-EXCERPTS)).map(
        (ticket, position) => ({
          id: crypto.randomUUID(),
          projectId,
          topicId: id,
          position,
          text: ticket.title.slice(0, EXCERPT_CHARS),
        }),
      ),
    };
  });
  const excerpts = rows.flatMap((row) => row.excerpts);
  await runBatch((tx) => [
    tx
      .delete(supportTopicExcerpts)
      .where(eq(supportTopicExcerpts.projectId, projectId)),
    tx.delete(supportTopics).where(eq(supportTopics.projectId, projectId)),
    ...rows.map((row) => tx.insert(supportTopics).values(row.topic)),
    ...Array.from(
      { length: Math.ceil(excerpts.length / EXCERPT_ROWS) },
      (_, index) =>
        tx
          .insert(supportTopicExcerpts)
          .values(
            excerpts.slice(index * EXCERPT_ROWS, (index + 1) * EXCERPT_ROWS),
          ),
    ),
    tx
      .update(supportSources)
      .set({ lastProcessedAt: updatedAt })
      .where(
        and(
          eq(supportSources.projectId, projectId),
          eq(supportSources.id, source.id),
        ),
      ),
  ]);
  return {
    status: "processed" as const,
    tickets: tickets.length,
    topics: rows.length,
  };
}
