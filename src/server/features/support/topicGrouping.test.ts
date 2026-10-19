import { expect, it } from "vitest";
import { bestDocsPage, groupTickets, topicTerms } from "./topicGrouping";

// RFC-0017 5.4 steps 4 and 5: similar tickets share a topic, the topic is
// named by its common words, and it maps to the best docs page or none.
const ticket = (title: string, vector: number[], day: number) => ({
  title,
  vector,
  createdAt: `2026-10-${String(day).padStart(2, "0")}T00:00:00Z`,
});

it("groups similar tickets and labels them by their common words", () => {
  const topics = groupTickets([
    ticket("Login fails with SSO", [1, 0.1], 1),
    ticket("Invoice shows the wrong VAT", [0, 1], 2),
    ticket("SSO login loop", [0.9, 0.2], 3),
  ]);
  expect(topics.map((topic) => topic.tickets.length)).toEqual([2, 1]);
  const terms = topicTerms(topics[0].tickets.map((item) => item.title));
  expect(terms).toEqual({
    stems: ["login", "sso", "fail"],
    label: "login sso fails",
  });
  const pages = [
    { id: "billing", texts: ["Billing", "Invoices"] },
    { id: "sso", texts: ["Single sign-on", "Fix an SSO login loop"] },
  ];
  expect(bestDocsPage(terms.stems, pages)).toBe("sso");
  expect(bestDocsPage(["webhook", "retry"], pages)).toBeNull();
});
