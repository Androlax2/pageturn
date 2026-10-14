/**
 * Films each example of examples/scenarios.ts for the README: Playwright records the
 * page, with a cursor drawn on it, and ffmpeg makes a GIF of it in docs/media/.
 *
 *   node scripts/record.mjs [name…]   (pnpm run record)
 *
 * Needs the built files (pnpm run build), the examples' server on port 4173 (started
 * here when none answers), and ffmpeg on the PATH.
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { scenarios } from "../examples/scenarios.ts";

const ORIGIN = "http://localhost:4173";
const SIZE = { width: 820, height: 480 };
const OUT = fileURLToPath(new URL("../docs/media/", import.meta.url));

/** A cursor drawn on every page, where the mouse is, and a ring where it presses. */
const CURSOR = `(() => {
  if (window.top !== window) return;
  const at = JSON.parse(sessionStorage.getItem("cursor") || "null") || { x: 480, y: 520 };
  const cursor = document.createElement("div");
  cursor.style.cssText = "position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;border-radius:50%;background:rgb(20 20 30 / 0.55);border:2px solid #fff;box-shadow:0 1px 4px rgb(0 0 0 / 0.3);transition:scale 0.15s";
  const place = ({ x, y }) => { cursor.style.translate = (x - 11) + "px " + (y - 11) + "px"; };
  place(at);
  const show = () => document.documentElement.append(cursor);
  if (document.documentElement) show(); else addEventListener("DOMContentLoaded", show);
  addEventListener("mousemove", (event) => {
    const now = { x: event.clientX, y: event.clientY };
    place(now);
    sessionStorage.setItem("cursor", JSON.stringify(now));
  }, true);
  addEventListener("mousedown", () => { cursor.style.scale = "0.7"; }, true);
  addEventListener("mouseup", () => { cursor.style.scale = ""; }, true);
  // A label for what the mouse does not show: the browser's Back.
  window.say = (words) => {
    const label = document.createElement("div");
    label.textContent = words;
    label.style.cssText = "position:fixed;left:50%;bottom:24px;translate:-50% 0;z-index:2147483647;padding:8px 16px;border-radius:999px;background:rgb(20 20 30 / 0.8);color:#fff;font:600 15px system-ui";
    document.documentElement.append(label);
  };
})();`;

const pause = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function serverAnswers() {
  try {
    return (await fetch(`${ORIGIN}/examples/`)).ok;
  } catch {
    return false;
  }
}

/** Moves the cursor to the middle of an element, as a hand would. */
async function pointAt(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`Nothing to click: ${selector}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 24,
  });
  await pause(250);
}

/** Waits until the page reached has arrived, and a little longer to be seen at rest. */
async function settled(page, left) {
  await page.waitForURL((url) => url.href !== left);
  await page.waitForLoadState("load");
  await page.waitForFunction(
    () => !document.documentElement.dataset.turnArriving,
  );
  await pause(1100);
}

async function record(browser, { name, start, steps }, folder) {
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: folder, size: SIZE },
  });
  const opened = Date.now();
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  await page.goto(ORIGIN + start);
  await page.waitForLoadState("load");
  await page.mouse.move(SIZE.width / 2, SIZE.height - 80);
  // The film starts here: what came before is the blank page and the first load.
  const startsAt = (Date.now() - opened) / 1000;
  await pause(900);
  for (const step of steps) {
    const left = page.url();
    if (step.back) {
      await page.evaluate(() => window.say("Back"));
      await pause(500);
      await page.goBack();
    } else {
      await pointAt(page, step.click);
      await page.mouse.down();
      await pause(90);
      await page.mouse.up(); // the click, where the cursor is
    }
    await settled(page, left);
  }
  const video = page.video();
  await context.close();
  const webm = await video.path();
  const gif = join(OUT, `${name}.gif`);
  // A palette made for this film, so that its colours and gradients stay clean.
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-ss",
    startsAt.toFixed(2),
    "-i",
    webm,
    "-vf",
    "fps=20,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle",
    "-loop",
    "0",
    gif,
  ]);
  console.log(`docs/media/${name}.gif`);
}

const wanted = process.argv.slice(2);
const server = (await serverAnswers())
  ? null
  : spawn(
      "node",
      [fileURLToPath(new URL("../tests/support/server.mjs", import.meta.url))],
      {
        stdio: "ignore",
      },
    );
for (let tries = 0; !(await serverAnswers()); tries++) {
  if (tries > 50) throw new Error(`No examples at ${ORIGIN}/examples/`);
  await pause(100);
}
await mkdir(OUT, { recursive: true });
const folder = await mkdtemp(join(tmpdir(), "pageturn-record-"));
const browser = await chromium.launch();
try {
  for (const scenario of scenarios) {
    if (!wanted.length || wanted.includes(scenario.name)) {
      await record(browser, scenario, folder);
    }
  }
} finally {
  await browser.close();
  server?.kill();
  await rm(folder, { recursive: true, force: true });
}
