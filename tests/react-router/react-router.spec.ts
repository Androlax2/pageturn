/**
 * pageturn/react-router on a React Router app (tests/react-router/fixture): moves on the
 * router's navigations, held by its middleware and swapped from the root layout's effect.
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

const APP: App = { base: "/react-router/fixture/build", ready: "reactReady" };
const open = (page: Page, path?: string) => openApp(page, APP, path);

test("a Link plays its move: leaving, then arriving in one step", async ({
  page,
}) => {
  await open(page);
  await page.click("#named");
  await expect(page).toHaveURL(/\/b$/);
  expectOneStep(await arrivedUnder(page, "named"), "named");
  await expect
    .poll(async () => (await noted(page, "arrived")).at(-1))
    .toEqual({ move: "named", entering: true, whole: true });
  expect(await noted(page, "loaded")).toHaveLength(1);
});

test("a move's data reaches the route rendered", async ({ page }) => {
  await open(page);
  await page.click("#tint");
  await expect(page).toHaveURL(/\/c$/);
  const marks = await arrivedUnder(page, "tint");
  expect(marks.find((m) => m.arriving === "tint")?.tone).toBe("teal");
  expect((await noted(page, "tint arrive")).at(-1)).toMatchObject({
    move: "tint",
    via: "link",
    data: { tone: "teal" },
  });
});

test("navigate() plays the default move, not a link's", async ({ page }) => {
  await open(page);
  await page.click("#to-c");
  await expect(page).toHaveURL(/\/c$/);
  await expect.poll(() => arrivalsOf(page, "page")).toBe(1);
  await page.click("#go");
  await expect(page).toHaveURL(/\/d$/);
  await expect.poll(() => arrivalsOf(page, "page")).toBe(2);
  expect(await arrivalsOf(page, "to-d")).toBe(0);
});

test("Back plays no leave and returns under returnAs", async ({ page }) => {
  await open(page);
  await page.click("#card");
  await expect(page).toHaveURL(/\/b$/);
  await expect.poll(() => arrivalsOf(page, "card")).toBe(1);
  const leaves = ((await noted(page, "marks")) as Marks[]).filter(
    (m) => m.leaving,
  ).length;
  await page.goBack();
  await expect(page).toHaveURL(/\/build\/$/);
  await arrivedUnder(page, "card-back");
  expect((await noted(page, "card-back arrive")).at(-1)).toEqual({
    move: "card-back",
    via: "history",
    from: `${APP.base}/b`,
    data: null,
    remembered: { y: 1 },
    reported: { shown: true },
  });
  expect(
    ((await noted(page, "marks")) as Marks[]).filter((m) => m.leaving),
  ).toHaveLength(leaves);
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
  await expect(page).toHaveURL(/\/b$/);
  await expect
    .poll(async () => (await noted(page, "slow stay")).at(-1))
    .toBe("superseded");
  await arrivedUnder(page, "page");
  expect(await arrivalsOf(page, "slow")).toBe(0);
});

test("a place in the same route plays no move", async ({ page }) => {
  await open(page);
  await page.click("#to-b");
  await expect.poll(() => arrivalsOf(page, "page")).toBe(1);
  const before = ((await noted(page, "marks")) as Marks[]).length;
  await page.click("#hash");
  await expect(page).toHaveURL(/\/b#below$/);
  await page.waitForTimeout(400);
  expect((await noted(page, "marks")) as Marks[]).toHaveLength(before);
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
