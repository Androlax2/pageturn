/**
 * pageturn/sveltekit on a built SvelteKit site (tests/sveltekit/fixture): moves on
 * SvelteKit's own navigations, and the head script from pageturn/sveltekit/server.
 */
import { expect, test } from "@playwright/test";
import {
  type App,
  noted as all,
  arrivedUnder,
  expectOneStep,
  type Marks,
  open as openApp,
} from "../support/framework.ts";

const APP: App = { base: "/sveltekit/build", ready: "kitReady" };
const BASE = APP.base;
const open = (page: Parameters<typeof openApp>[0], path?: string) =>
  openApp(page, APP, path);

test("the server hook puts the head script first in the head", async ({
  request,
}) => {
  const html = await (await request.get(`${BASE}/`)).text();
  expect(html).toMatch(/<head>\s*<meta charset="utf-8" \/><script>\(\(\)=>\{/);
});

test("a link SvelteKit handles plays its move: leaving, then arriving in one step", async ({
  page,
}) => {
  await open(page);
  await page.click("#named");
  await expect(page).toHaveURL(/\/b\/$/);
  expectOneStep(await arrivedUnder(page, "named"), "named");
  await expect
    .poll(async () => (await all(page, "arrived")).at(-1))
    .toEqual({ move: "named", entering: true, whole: true });
});

test("a move's data reaches the page SvelteKit renders", async ({ page }) => {
  await open(page);
  await page.click("#tint");
  await expect(page).toHaveURL(/\/c\/$/);
  const marks = await arrivedUnder(page, "tint");
  expect(marks.find((m) => m.arriving === "tint")?.tone).toBe("teal");
  expect((await all(page, "tint arrive")).at(-1)).toMatchObject({
    move: "tint",
    via: "link",
    data: { tone: "teal" },
  });
});

test("goto() plays the default move", async ({ page }) => {
  await open(page, "/c/");
  await page.click("#go");
  await expect(page).toHaveURL(/\/b\/$/);
  await arrivedUnder(page, "page");
});

test("Back plays no leave and returns under returnAs", async ({ page }) => {
  await open(page);
  await page.click("#card");
  await expect(page).toHaveURL(/\/b\/$/);
  await expect
    .poll(async () => (await all(page, "arrived")).length)
    .toBeGreaterThan(0);
  const leaves = ((await all(page, "marks")) as Marks[]).filter(
    (m) => m.leaving,
  ).length;
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${BASE}/$`));
  await arrivedUnder(page, "card-back");
  expect((await all(page, "card-back arrive")).at(-1)).toEqual({
    move: "card-back",
    via: "history",
    from: `${BASE}/b/`,
    data: null,
    remembered: { y: 1 },
    reported: { shown: true },
  });
  expect(
    ((await all(page, "marks")) as Marks[]).filter((m) => m.leaving),
  ).toHaveLength(leaves);
});

test("a navigation another beforeNavigate cancels puts the page back", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    (window as { cancelNext?: boolean }).cancelNext = true;
  });
  await page.click("#to-b");
  await expect
    .poll(async () => (await all(page, "stay")).at(-1))
    .toEqual({ move: "page", reason: "cancelled" });
  expect(page.url()).toMatch(new RegExp(`${BASE}/$`));
  expect(
    await page.evaluate(
      () => "turnLeaving" in document.documentElement.dataset,
    ),
  ).toBe(false);
});

test("a link SvelteKit leaves to the browser is a real navigation, with its move", async ({
  page,
}) => {
  await open(page);
  await page.click("#reload");
  await expect(page).toHaveURL(/\/c\/$/);
  await page.waitForLoadState("load");
  await expect
    .poll(async () => (await all(page, "loaded")).at(-1))
    .toMatchObject({ move: "reloaded", via: "link" });
});
