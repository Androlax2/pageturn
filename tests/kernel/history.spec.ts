/**
 * Back and Forward: a return played by the move that left the page. Playwright's browsers reload a page on Back (no bfcache), so
 * a real bfcache return is simulated by dispatching pageshow with persisted: true.
 */
import { expect, test } from "@playwright/test";
import { noted, notes, type PageSpec, serve } from "../support/site.ts";

const LIST: PageSpec = {
  body: `<a id="open" href="/t/project" data-turn="project">project</a>`,
  script: `pageturn.defineMove("project", {
    leave: (turn) => turn.leaving().then(() => ({
      data: { from: "list" },
      returnAs: "project-back",
      remember: { scrollTop: 40 },
    })),
    stay: (turn, stay) => note("restore", stay),
  });
  pageturn.defineMove("project-back", {
    arrive: (arrival) => note("arrive", arrival),
  });`,
};

const PROJECT: PageSpec = {
  script: `pageturn.whenLeft(() => ({ box: 7 }));`,
};

test("Back to a page left by a move with returnAs plays its return", async ({
  page,
  context,
}) => {
  await serve(context, { list: LIST, project: PROJECT });
  await page.goto("/t/list");
  await page.click("#open");
  await page.waitForURL("**/t/project");
  await page.goBack();
  await page.waitForURL("**/t/list");
  expect(await noted(page, "/t/list", "arrival")).toEqual({
    move: "project-back",
    via: "history",
    from: "/t/project",
    data: null,
    remembered: { scrollTop: 40 },
    reported: { box: 7 },
  });
  // The move the page arrives under is told, once, by the same arrival.
  expect(await noted(page, "/t/list", "arrive")).toEqual(
    await noted(page, "/t/list", "arrival"),
  );
  expect(await noted(page, "/t/list", "arriving")).toBe("project-back");
});

test("a page reached by a move reports its departure even without whenLeft", async ({
  page,
  context,
}) => {
  await serve(context, { list: LIST, project: {} });
  await page.goto("/t/list");
  await page.click("#open");
  await page.waitForURL("**/t/project");
  await page.goBack();
  await page.waitForURL("**/t/list");
  expect(await noted(page, "/t/list", "arrival")).toMatchObject({
    move: "project-back",
    data: null,
  });
});

test("no return when the page left reports that there is nothing to return to", async ({
  page,
  context,
}) => {
  await serve(context, {
    list: LIST,
    project: { script: `pageturn.whenLeft((leaving) => leaving.decline());` },
  });
  await page.goto("/t/list");
  await page.click("#open");
  await page.waitForURL("**/t/project");
  await page.goBack();
  await page.waitForURL("**/t/list");
  expect(await noted(page, "/t/list", "arrival")).toBeNull();
  expect(await noted(page, "/t/list", "arriving")).toBeNull();
});

test("no return when another page came between", async ({ page, context }) => {
  await serve(context, { list: LIST, project: PROJECT, other: {} });
  await page.goto("/t/list");
  await page.click("#open");
  await page.waitForURL("**/t/project");
  await page.click("#to-other");
  await page.waitForURL("**/t/other");
  await page.evaluate(() => history.go(-2));
  await page.waitForURL("**/t/list");
  expect(await noted(page, "/t/list", "arrival")).toBeNull();
});

test("no return after more than 3 s", async ({ page, context }) => {
  // The project page's clock runs 3.5 s behind from its pagehide on, so its departure
  // record is already stale when the list reads it.
  await context.addInitScript(() => {
    if (location.pathname !== "/t/project") return;
    addEventListener(
      "pagehide",
      () => {
        const now = Date.now.bind(Date);
        Date.now = () => now() - 3_500;
      },
      true,
    );
  });
  await serve(context, { list: LIST, project: PROJECT });
  await page.goto("/t/list");
  await page.click("#open");
  await page.waitForURL("**/t/project");
  await page.goBack();
  await page.waitForURL("**/t/list");
  expect(await noted(page, "/t/list", "arrival")).toBeNull();
});

test("no return when the move declared no returnAs", async ({
  page,
  context,
}) => {
  await serve(context, { a: {}, b: PROJECT });
  await page.goto("/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  await page.goBack();
  await page.waitForURL("**/t/a");
  expect(await noted(page, "/t/a", "arrival")).toBeNull();
  expect(await noted(page, "/t/a", "arriving")).toBeNull();
});

test("the entry record keeps the rest of history.state", async ({
  page,
  context,
}) => {
  await serve(context, { list: LIST, project: PROJECT });
  await page.goto("/t/list");
  await page.evaluate(() => history.replaceState({ mine: 1 }, ""));
  await page.click("#open");
  await page.waitForURL("**/t/project");
  await page.goBack();
  await page.waitForURL("**/t/list");
  expect(await page.evaluate(() => history.state)).toMatchObject({
    mine: 1,
    pageturn: { move: "project", to: "/t/project", returnAs: "project-back" },
  });
});

test("a return from bfcache restores the move, once, with its arrival", async ({
  page,
  context,
}) => {
  await serve(context, {
    list: {
      ...LIST,
      script: `${LIST.script} pageturn.configure({ stuckTimeout: 60000 });`,
    },
    project: { stays: true },
  });
  await page.goto("/t/list");
  // Clicked from script: Playwright's click would wait for a navigation the 204 cancels.
  await page.evaluate(() => document.getElementById("open")?.click());
  await page.waitForTimeout(600);
  expect(
    await page.evaluate(() => document.documentElement.dataset.turnLeaving),
  ).toBe("project");
  // Read as it is shown: with no animation, its arrival ends two frames later.
  const shown = await page.evaluate(() => {
    // What the project page would have written as it went.
    sessionStorage.setItem(
      "pageturn:left",
      JSON.stringify({ from: "/t/project", at: Date.now(), data: { box: 3 } }),
    );
    dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    return {
      leaving: document.documentElement.dataset.turnLeaving ?? null,
      arriving: document.documentElement.dataset.turnArriving ?? null,
    };
  });
  const arrival = {
    move: "project-back",
    via: "history",
    from: "/t/project",
    data: null,
    remembered: { scrollTop: 40 },
    reported: { box: 3 },
  };
  expect(await noted(page, "/t/list", "restore")).toEqual({
    reason: "returned",
    // What leave answered reaches stay too.
    handover: {
      data: { from: "list" },
      returnAs: "project-back",
      remember: { scrollTop: 40 },
    },
  });
  expect(await noted(page, "/t/list", "stay")).toEqual({
    move: "project",
    reason: "returned",
  });
  expect(shown).toEqual({ leaving: null, arriving: "project-back" });
  expect(await page.evaluate(() => window.pageturn?.arrival)).toEqual(arrival);
  // From the cache too, the move the page arrives under is told: one place for both.
  expect(await noted(page, "/t/list", "arrive")).toEqual(arrival);
});

test("a return from bfcache without returnAs only clears the leave", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: {
      script: `pageturn.configure({ stuckTimeout: 60000 });
        pageturn.defineMove("page", {
          leave: (turn) => turn.leaving().then(() => ({})),
          stay: (turn, stay) => note("restore", stay),
        });`,
    },
    b: { stays: true },
  });
  await page.goto("/t/a");
  await page.click("#to-b");
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  expect(await noted(page, "/t/a", "restore")).toEqual({
    reason: "returned",
    handover: {},
  });
  expect(
    await page.evaluate(() => document.documentElement.dataset.turnLeaving),
  ).toBeUndefined();
});

test("a second return from bfcache, with no turn under way, still plays the return", async ({
  page,
  context,
}) => {
  await serve(context, {
    list: {
      ...LIST,
      script: `${LIST.script} pageturn.configure({ stuckTimeout: 60000 });`,
    },
    project: { stays: true },
  });
  await page.goto("/t/list");
  await page.evaluate(() => document.getElementById("open")?.click());
  await page.waitForTimeout(600);
  const returnFromCache = () =>
    page.evaluate(() => {
      dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      // What the project page would have written as it went.
      sessionStorage.setItem(
        "pageturn:left",
        JSON.stringify({ from: "/t/project", at: Date.now(), data: null }),
      );
      dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      return document.documentElement.dataset.turnArriving ?? null;
    });
  // Back from the cache, then Forward and Back again: the turn is over by then.
  expect(await returnFromCache()).toBe("project-back");
  expect(await returnFromCache()).toBe("project-back");
  expect(
    (await notes(page)).filter((note) => note.key === "arrive"),
  ).toHaveLength(2);
});

test("history.state is left alone when it is not a plain object, or when there is nothing to write", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: {
      body: `<a id="card" href="/t/b" data-turn="card">b</a>`,
      script: `
        window.replaced = 0;
        const replace = history.replaceState.bind(history);
        history.replaceState = (...args) => { window.replaced += 1; return replace(...args); };
        pageturn.defineMove("card", {
          leave: (turn) => turn.leaving().then(() => ({ returnAs: "card-back" })),
        });`,
    },
    b: { stays: true },
  });
  // Nothing to write: a move with no returnAs, on an entry with no record.
  await page.goto("/t/a");
  await page.evaluate(() => document.getElementById("to-b")?.click());
  await page.waitForTimeout(600);
  expect(
    await page.evaluate(() => (window as { replaced?: number }).replaced),
  ).toBe(0);
  // A router's own state, an array: kept as it is, even by a move with returnAs.
  await page.goto("/t/a");
  await page.evaluate(() => history.replaceState([1, 2], ""));
  await page.evaluate(() => document.getElementById("card")?.click());
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => history.state)).toEqual([1, 2]);
});
