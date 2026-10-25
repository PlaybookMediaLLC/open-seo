import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("keeps release notes in a private temporary directory and removes them", () => {
  const scratch = mkdtempSync(path.join(tmpdir(), "release-notes-test-"));
  try {
    const bin = path.join(scratch, "bin");
    mkdirSync(bin);
    writeFileSync(
      path.join(bin, "git"),
      '#!/bin/sh\nprintf "fix: Test change\\n"\n',
      { mode: 0o700 },
    );
    const capture = path.join(scratch, "capture.json");
    writeFileSync(
      path.join(bin, "gh"),
      `#!/usr/bin/env node
const fs = require("node:fs"), path = require("node:path");
const file = process.argv[process.argv.indexOf("--notes-file") + 1];
fs.writeFileSync(process.env.RELEASE_TEST_CAPTURE, JSON.stringify({
  file, dirMode: fs.statSync(path.dirname(file)).mode & 0o777,
  fileMode: fs.statSync(file).mode & 0o777, notes: fs.readFileSync(file, "utf8")
}));
`,
      { mode: 0o700 },
    );
    const preload = path.join(scratch, "clock.mjs");
    writeFileSync(preload, "Date.now = () => 123456789;\n");
    const victim = path.join(scratch, "victim.txt");
    writeFileSync(victim, "keep this file");
    symlinkSync(
      victim,
      path.join(scratch, "quick-eagle-release-notes-123456789.md"),
    );

    execFileSync(
      process.execPath,
      [
        fileURLToPath(new URL("./release-notes.mjs", import.meta.url)),
        "--from",
        "HEAD~1",
        "--to",
        "HEAD",
        "--repo",
        "example/local-fixture",
        "--draft",
        "0.0.0-test",
      ],
      {
        cwd: scratch,
        env: {
          ...process.env,
          PATH: `${bin}${path.delimiter}${process.env.PATH}`,
          TMPDIR: scratch,
          NODE_OPTIONS: `--import=${preload}`,
          RELEASE_TEST_CAPTURE: capture,
        },
        stdio: "pipe",
      },
    );

    expect(readFileSync(victim, "utf8")).toBe("keep this file");
    const recorded = JSON.parse(readFileSync(capture, "utf8"));
    expect(recorded).toMatchObject({ dirMode: 0o700, fileMode: 0o600 });
    expect(recorded.notes).toContain("Test change");
    expect(existsSync(path.dirname(recorded.file))).toBe(false);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
