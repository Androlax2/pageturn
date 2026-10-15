/**
 * pageturn/next on an exported App Router site (tests/next/fixture): the router's
 * navigation stopped, the leave played, the router asked again; the page reached swapped
 * from <Pageturn />'s layout effect.
 */
import { expect, type Page, test } from "@playwright/test";
import {
  type App,
  arrivalsOf,
  arrivedUnder,
  expectOneStep,
  type Marks,
  noted,
  open as openApp,
} from "../support/framework.ts";

const APP: App = { base: "/next/fixture/out", ready: "nextReady" };
const open = (page: Page, path?: string) => openApp(page, APP, path);

test("pageturn's Link plays its move: leaving, then arriving in one step", async ({
  page,
}) => {
  await open(page);
  await page.click("#named");
  await expect(page).toHaveURL(/\/b\/$/);
  expectOneStep(await arrivedUnder(page, "named"), "named");
  await expect
    .poll(async () => (await noted(page, "arrived")).at(-1))
    .toEqual({ move: "named", entering: true, whole: true });
  // The router rendered the page: it was never loaded again.
  expect(await noted(page, "loaded")).toHaveLength(1);
});

test("a move's data reaches the page the router renders", async ({ page }) => {
  await open(page);
  await page.click("#tint");
  await expect(page).toHaveURL(/\/c\/$/);
  const marks = await arrivedUnder(page, "tint");
  expect(marks.find((m) => m.arriving === "tint")?.tone).toBe("teal");
  expect((await noted(page, "tint arrive")).at(-1)).toMatchObject({
    move: "tint",
    via: "link",
    data: { tone: "teal" },
  });
});

test("useTurnRouter().push() plays the default move, not a link's", async ({
  page,
}) => {
  await open(page);
  await page.click("#to-c");
  await expect(page).toHaveURL(/\/c\/$/);
  await expect.poll(() => arrivalsOf(page, "page")).toBe(1);
  await page.click("#go");
  await expect(page).toHaveURL(/\/d\/$/);
  await expect.poll(() => arrivalsOf(page, "page")).toBe(2);
  expect(await arrivalsOf(page, "to-d")).toBe(0);
});

test("Back plays no leave and returns under returnAs", async ({ page }) => {
  await open(page);
  await page.click("#card");
  await expect(page).toHaveURL(/\/b\/$/);
  await expect.poll(() => arrivalsOf(page, "card")).toBe(1);
  const leaves = ((await noted(page, "marks")) as Marks[]).filter(
    (m) => m.leaving,
  ).length;
  await page.goBack();
  await expect(page).toHaveURL(/\/out\/$/);
  await arrivedUnder(page, "card-back");
  expect((await noted(page, "card-back arrive")).at(-1)).toMatchObject({
    move: "card-back",
    via: "history",
    remembered: { y: 1 },
    reported: { shown: true },
  });
  expect(
    ((await noted(page, "marks")) as Marks[]).filter((m) => m.leaving),
  ).toHaveLength(leaves);
});

test("a Link whose own onNavigate stops it plays nothing and goes nowhere", async ({
  page,
}) => {
  await open(page);
  await page.click("#stopped");
  await page.waitForTimeout(500);
  expect(page.url()).toMatch(/\/out\/$/);
  expect(await noted(page, "marks")).toEqual([]);
});

test("a navigation another overtakes ends with its move told so", async ({
  page,
}) => {
  await open(page);
  await page.click("#slow");
  await expect
    .poll(async () => (await noted(page, "marks")).length)
    .toBeGreaterThan(0);
  await page.click("#to-b");
  await expect(page).toHaveURL(/\/b\/$/);
  await expect
    .poll(async () => (await noted(page, "slow stay")).at(-1))
    .toBe("superseded");
  await arrivedUnder(page, "page");
  // The overtaken leave never asked the router: the page never went to /d.
  expect(await arrivalsOf(page, "slow")).toBe(0);
});

test("a plain link out of the app is a real navigation, with its move", async ({
  page,
}) => {
  await open(page);
  await page.click("#reload");
  await expect(page).toHaveURL(/\/real\.html$/);
  await page.waitForLoadState("load");
  await expect
    .poll(async () => (await noted(page, "loaded")).at(-1))
    .toMatchObject({ move: "reloaded", via: "link" });
});
