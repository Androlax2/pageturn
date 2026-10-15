/**
 * pageturn/nuxt on a generated Nuxt app (tests/nuxt/fixture): the head script from the
 * module, and moves on Nuxt's navigations, swapped once its <Suspense> has resolved.
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

const APP: App = { base: "/nuxt/fixture/.output/public", ready: "nuxtReady" };
const open = (page: Page, path?: string) => openApp(page, APP, path);

test("a NuxtLink plays its move: leaving, then arriving in one step", async ({
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

test("navigateTo() plays the default move, not a link's", async ({ page }) => {
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
  await expect(page).toHaveURL(/\/public\/$/);
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

test("a navigation a guard aborts puts the page back", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    (window as { cancelNext?: boolean }).cancelNext = true;
  });
  await page.click("#to-b");
  await expect
    .poll(async () => (await noted(page, "stay")).at(-1))
    .toEqual({ move: "page", reason: "cancelled" });
  expect(page.url()).toMatch(/\/public\/$/);
  expect(
    await page.evaluate(
      () => "turnLeaving" in document.documentElement.dataset,
    ),
  ).toBe(false);
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
  await expect(page).toHaveURL(/\/real\/$/);
  await page.waitForLoadState("load");
  await expect
    .poll(async () => (await noted(page, "loaded")).at(-1))
    .toMatchObject({ move: "reloaded", via: "link" });
});

test("the module puts the head script before the page's own scripts", async ({
  request,
}) => {
  const html = await (await request.get(`${APP.base}/`)).text();
  const head = html.slice(0, html.indexOf("</head>"));
  const script = head.indexOf("<script>(()=>{");
  expect(script).toBeGreaterThan(-1);
  // Only the import map, which runs nothing, may come before it.
  expect(
    head.slice(0, script).match(/<script(?! type="importmap")/g),
  ).toBeNull();
});
