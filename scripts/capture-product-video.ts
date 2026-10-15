/**
 * Record the product walkthrough video the landing page plays in its hero.
 *
 * The marketing page shows the real app, not drawings, so re-record whenever
 * the UI it shows changes.
 *
 *   pnpm db:migrate:local      # once
 *   pnpm seed:marketing        # opportunities, Search Console, saved keywords
 *   pnpm seed:rank-tracking    # rank tracking history
 *   # AUTH_MODE=local_noauth, with any DATAFORSEO_API_KEY so the app does not
 *   # show its local-setup notices (the tour makes no DataForSEO calls):
 *   CLOUDFLARE_INCLUDE_PROCESS_ENV=true DATAFORSEO_API_KEY=placeholder pnpm dev
 *   pnpm capture:product       # needs ffmpeg and cwebp (brew install ffmpeg webp)
 *
 * Writes app-demo.mp4 (H.264, for Safari), app-demo.webm (VP9) and the
 * app-demo.webp poster into src/public/product/. Commit the results.
 */

import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { chromium, type Page } from "@playwright/test";
import { parseArgs } from "./cli-utils";

const OUT_DIR = "src/public/product";
const VIEWPORT = { width: 1360, height: 850 };
// Frames are captured at 2x and scaled to this width, sharp on retina at the
// size the hero renders the window.
const OUTPUT_WIDTH = 1920;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const origin = args.origin ?? "http://localhost:3001";
  await mkdir(OUT_DIR, { recursive: true });
  const frameDir = await mkdtemp(join(tmpdir(), "relay-video-"));

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
  });
  await page.addInitScript(prepareDemoPage);

  try {
    await page.goto(`${origin}/app`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(4000);
    const projectBase = page.url().replace(/\/$/, "");
    if (!projectBase.includes("/p/")) {
      throw new Error(
        `Expected to land on a project page, got ${page.url()}. Is the dev server running with AUTH_MODE=local_noauth?`,
      );
    }
    await page.goto(`${projectBase}/opportunities`, {
      waitUntil: "networkidle",
    });
    await settle(page);
    // Start where the tour ends, so the first and last frames match.
    await page.mouse.move(VIEWPORT.width - 40, VIEWPORT.height - 40);

    const frames = await record(page, () => walkthrough(page));
    console.log(`Captured ${frames.length} frames`);
    await encode(frames, frameDir);
  } finally {
    await browser.close();
    await rm(frameDir, { recursive: true, force: true });
  }

  console.log("\nDone. Review the video, then commit src/public/product/.");
}

/** The scripted tour. It ends on the page it starts on, so the video loops. */
async function walkthrough(page: Page) {
  await pause(page, 1200);
  await hover(page, page.getByRole("row").nth(1));
  await pause(page, 900);
  await scroll(page, 360);
  await pause(page, 700);
  await scroll(page, -360);

  await click(page, page.getByRole("link", { name: "Rank Tracking" }));
  await pause(page, 1500);
  await click(page, page.getByRole("link", { name: /^Open / }).first());
  await pause(page, 2600);
  await scroll(page, 420);
  await hover(page, page.getByRole("row").nth(2));
  await pause(page, 1000);
  await scroll(page, -420);

  await click(page, page.getByRole("link", { name: "Saved Keywords" }));
  await pause(page, 1200);
  await hover(page, page.getByRole("row").nth(3));
  await pause(page, 900);
  await hover(page, page.getByRole("row").nth(6));
  await pause(page, 900);

  await click(page, page.getByRole("link", { name: "Opportunities" }));
  await page.mouse.move(VIEWPORT.width - 40, VIEWPORT.height - 40, {
    steps: 25,
  });
  await pause(page, 1500);
}

type Frame = { data: string; time: number };

/** Records Chrome's screencast (JPEG frames with timestamps) while `act` runs. */
async function record(page: Page, act: () => Promise<void>) {
  const cdp = await page.context().newCDPSession(page);
  const frames: Frame[] = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    frames.push({ data, time: metadata.timestamp ?? Date.now() / 1000 });
    void cdp.send("Page.screencastFrameAck", { sessionId });
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    maxWidth: VIEWPORT.width * 2,
    maxHeight: VIEWPORT.height * 2,
  });
  await act();
  await cdp.send("Page.stopScreencast");
  // The screencast only sends a frame when the page repaints. Hold the last
  // one so the end of the tour is not cut short.
  const last = frames.at(-1);
  if (last) frames.push({ data: last.data, time: last.time + 0.5 });
  return frames;
}

/** Writes the frames with their real durations, then encodes MP4, WebM and the poster. */
async function encode(frames: Frame[], dir: string) {
  const list: string[] = [];
  for (const [index, frame] of frames.entries()) {
    const file = join(dir, `${String(index).padStart(5, "0")}.jpg`);
    await writeFile(file, Buffer.from(frame.data, "base64"));
    const next = frames[index + 1];
    list.push(`file '${file}'`);
    if (next) list.push(`duration ${(next.time - frame.time).toFixed(4)}`);
  }
  const listFile = join(dir, "frames.txt");
  await writeFile(listFile, `${list.join("\n")}\n`);

  const input = ["-y", "-f", "concat", "-safe", "0", "-i", listFile];
  const scale = `scale=${OUTPUT_WIDTH}:-2:flags=lanczos,format=yuv420p`;
  ffmpeg([
    ...input,
    "-vf",
    scale,
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "21",
    "-movflags",
    "+faststart",
    "-an",
    `${OUT_DIR}/app-demo.mp4`,
  ]);
  ffmpeg([
    ...input,
    "-vf",
    scale,
    "-r",
    "30",
    "-c:v",
    "libvpx-vp9",
    "-crf",
    "33",
    "-b:v",
    "0",
    "-row-mt",
    "1",
    "-an",
    `${OUT_DIR}/app-demo.webm`,
  ]);
  // The poster is the first frame, so the video starts without a jump.
  run("cwebp", [
    "-quiet",
    "-q",
    "82",
    "-resize",
    String(OUTPUT_WIDTH),
    "0",
    join(dir, "00000.jpg"),
    "-o",
    `${OUT_DIR}/app-demo.webp`,
  ]);
  console.log(`Wrote ${OUT_DIR}/app-demo.{mp4,webm,webp}`);
}

function ffmpeg(args: string[]) {
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args]);
}

/** ffmpeg and cwebp: `brew install ffmpeg webp` or `apt install ffmpeg webp`. */
function run(tool: string, args: string[]) {
  try {
    execFileSync(tool, args, { stdio: ["ignore", "ignore", "inherit"] });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`${tool} not found. Install ffmpeg and webp.`);
    }
    throw error;
  }
}

type Target = ReturnType<Page["getByRole"]>;

/** Glides the visible cursor to the middle of `target`. */
async function hover(page: Page, target: Target) {
  const box = await target.boundingBox();
  if (!box) throw new Error(`Nothing to point at: ${target.toString()}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 28,
  });
}

async function click(page: Page, target: Target) {
  await hover(page, target);
  await pause(page, 250);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForLoadState("networkidle");
  await settle(page);
}

/** Scrolls whatever is under the cursor, smoothly, like a trackpad. */
async function scroll(page: Page, distance: number) {
  const steps = 24;
  for (let step = 0; step < steps; step += 1) {
    await page.mouse.wheel(0, distance / steps);
    await page.waitForTimeout(16);
  }
}

function pause(page: Page, ms: number) {
  return page.waitForTimeout(ms);
}

/** Dismiss transient overlays and let charts finish their entry animation. */
async function settle(page: Page) {
  await page.waitForTimeout(600);
  // Setup prompts and nudges are state, not product: they must not appear in
  // marketing footage.
  const dismiss = page.getByRole("button", { name: /^(Dismiss|Not now)$/ });
  if (await dismiss.count()) {
    await dismiss
      .first()
      .click()
      .catch(() => {});
    await page.waitForTimeout(400);
  }
}

/**
 * Runs in the page before its own scripts: dark theme, and a visible cursor
 * (the screencast does not draw the real one).
 */
function prepareDemoPage() {
  localStorage.setItem("theme-preference", "dark");
  addEventListener("DOMContentLoaded", () => {
    const cursor = document.createElement("div");
    cursor.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M4 2v16.5l4.3-4.1 3 6.6 2.7-1.2-3-6.5H17z" fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    Object.assign(cursor.style, {
      position: "fixed",
      left: "0",
      top: "0",
      zIndex: "2147483647",
      pointerEvents: "none",
      transform: "translate(-60px, -60px)",
      filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.4))",
    });
    document.documentElement.appendChild(cursor);
    addEventListener(
      "mousemove",
      (event) => {
        cursor.style.transform = `translate(${event.clientX - 4}px, ${event.clientY - 2}px)`;
      },
      true,
    );
  });
}

await main();
