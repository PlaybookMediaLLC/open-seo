import { expect, it, vi } from "vitest";
import type { GithubClient } from "./githubClient";
import { gitBlobHash } from "./proposalFingerprint";
import { prepareChangeAt } from "./publishingTarget";

const files: Record<string, string> = {
  "package.json": '{"dependencies":{"next":"15.4.0"}}',
  "pages/about.tsx":
    'import Head from "next/head";\nexport default function About() { return <Head><title>About our team</title></Head>; }\n',
};
const readFile = vi.fn<GithubClient["readFile"]>(async (path) => ({
  source: files[path],
  blobSha: await gitBlobHash(files[path]),
}));

it("uses the Pages Router adapter for a pages/ file and reads no helper", async () => {
  const change = await prepareChangeAt(
    { readFile },
    { rootDirectory: "" },
    {
      filePath: "pages/about.tsx",
      url: "https://example.com/about",
      sha: "a".repeat(40),
      newTitle: "The team behind Example",
    },
  );
  expect(change.adapterId).toBe("pages_router_head");
  expect(change.patch.afterSource).toContain(
    "<title>The team behind Example</title>",
  );
  expect(readFile.mock.calls.map(([path]) => path)).toEqual([
    "package.json",
    "pages/about.tsx",
  ]);
});
