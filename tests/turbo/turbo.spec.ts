/**
 * pageturn/turbo on a site with Turbo Drive (tests/turbo/fixture): moves on Turbo's
 * visits, which swap the body without loading a page.
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

const APP: App = { base: "/turbo/fixture/build", ready: "turboReady" };
const open = (page: Page, path?: string) => openApp(page, APP, path);

test("a link Turbo visits plays its move: leaving, then arriving in one step", async ({
  page,
}) => {
  await open(page);
  await page.click("#named");
  await expect(page).toHaveURL(/\/b\.html$/);
  expectOneStep(await arrivedUnder(page, "named"), "named");
  await expect
    .poll(async () => (await noted(page, "arrived")).at(-1))
    .toEqual({ move: "named", entering: true, whole: true });
  // Turbo swapped the body: the page was never loaded again.
  expect(await noted(page, "loaded")).toHaveLength(1);
});

test("a move's data reaches the page Turbo renders", async ({ page }) => {
  await open(page);
  await page.click("#tint");
  await expect(page).toHaveURL(/\/c\.html$/);
  const marks = await arrivedUnder(page, "tint");
  expect(marks.find((m) => m.arriving === "tint")?.tone).toBe("teal");
  expect((await noted(page, "tint arrive")).at(-1)).toMatchObject({
    move: "tint",
    via: "link",
    data: { tone: "teal" },
  });
});

test("Turbo.visit() plays the default move", async ({ page }) => {
  await open(page, "/c.html");
  await page.click("#go");
  await expect(page).toHaveURL(/\/b\.html$/);
  await arrivedUnder(page, "page");
});

test("a page Turbo has cached arrives once: its preview is not shown under the leave", async ({
  page,
}) => {
  await open(page);
  await page.click("#to-b");
  await expect(page).toHaveURL(/\/b\.html$/);
  await expect.poll(() => arrivalsOf(page, "page")).toBe(1);
  // Back to a by a link: Turbo has it cached, and shows a preview before the real page.
  await page.click("#to-a");
  await expect(page).toHaveURL(/\/build\/$/);
  await expect.poll(() => arrivalsOf(page, "page")).toBe(2);
  // Turbo did render a preview on the way, and nothing arrived while it showed.
  expect(await noted(page, "preview")).not.toHaveLength(0);
  const duringPreview = (
    (await noted(page, "marks")) as (Marks & { preview: boolean })[]
  ).filter((m) => m.preview && m.arriving);
  expect(duringPreview).toEqual([]);
  const marks = (await noted(page, "marks")) as Marks[];
  const arrivals = marks.filter((m) => m.arriving === "page");
  expect(arrivals).toHaveLength(2);
  expectOneStep(marks.slice(marks.indexOf(arrivals[0] as Marks) + 1), "page");
});

test("Back plays no leave and returns under returnAs", async ({ page }) => {
  await open(page);
  await page.click("#card");
  await expect(page).toHaveURL(/\/b\.html$/);
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
    from: `${APP.base}/b.html`,
    data: null,
    remembered: { y: 1 },
    reported: { shown: true },
  });
  expect(
    ((await noted(page, "marks")) as Marks[]).filter((m) => m.leaving),
  ).toHaveLength(leaves);
});

test("a visit another listener cancels puts the page back", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    (window as { cancelNext?: boolean }).cancelNext = true;
  });
  await page.click("#to-b");
  await expect
    .poll(async () => (await noted(page, "stay")).at(-1))
    .toEqual({ move: "page", reason: "cancelled" });
  expect(page.url()).toMatch(/\/build\/$/);
  expect(
    await page.evaluate(
      () => "turnLeaving" in document.documentElement.dataset,
    ),
  ).toBe(false);
});

test("a link Turbo leaves to the browser is a real navigation, with its move", async ({
  page,
}) => {
  await open(page);
  await page.click("#reload");
  await expect(page).toHaveURL(/\/c\.html$/);
  await page.waitForLoadState("load");
  await expect
    .poll(async () => (await noted(page, "loaded")).at(-1))
    .toMatchObject({ move: "reloaded", via: "link" });
});
