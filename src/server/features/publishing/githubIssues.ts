import { z } from "zod";
import type { GithubRequest } from "./githubRead";

const issueSchema = z.object({
  number: z.number().int().positive(),
  html_url: z.url(),
  body: z.string().nullable().optional(),
});

// Issue calls for approved tickets. They need Issues read and write.
export function createGithubIssues(request: GithubRequest) {
  return {
    async createIssue(input: { title: string; body: string }) {
      const issue = await request("/issues", issueSchema, {
        method: "POST",
        body: input,
      });
      return { number: issue.number, url: issue.html_url };
    },
    // Recovery after an interrupted create: find the issue by its marker.
    async findIssue(marker: string) {
      const issues = await request(
        "/issues?state=all&sort=created&direction=desc&per_page=50",
        z.array(issueSchema),
      );
      const issue = issues.find((item) => item.body?.includes(marker));
      return issue ? { number: issue.number, url: issue.html_url } : null;
    },
  };
}
