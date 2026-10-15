/**
 * pageturn/router: moves on a client router's navigations, driven by the reference
 * router of support.ts. The page first loaded stays; only <main> changes.
 */
import { expect, type Page, test } from "@playwright/test";
import { noted, notes, serve } from "../support/site.ts";
import { LEAVE_CSS, routed } from "./support.ts";

/** Moves defined in a module on the first page, which stays for the whole visit. */
const moves = (code: string): string =>
  `<script type="module">import { defineMove, whenLeft } from "/dist/index.js"; ${code}</script>`;

async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(
    () => (window as { routerReady?: true }).routerReady,
  );
}

/** The marks after the n-th swap of the visit, as the page first loaded noted them. */
async function swaps(page: Page, path: string): Promise<unknown[]> {
  return (await notes(page))
    .filter((note) => note.page === path && note.key === "after swap")
    .map((note) => note.value);
}

test("a link the router handles plays its move: the swap waits for the leave, and the marks change in one step", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: routed({
      css: LEAVE_CSS,
      body: `<a id="card" href="/t/b" data-turn="card">b</a>`,
    }),
    b: routed(),
  });
  await open(page, "/t/a");
  await page.click("#card");
  await page.waitForURL("**/t/b");
  // Only after the leave had ended, with its mark still on.
  await expect
    .poll(() => noted(page, "/t/a", "before swap"))
    .toMatchObject({ leaving: "card", arriving: null, running: 0 });
  // In the same task as the swap: leaving gone, arriving set, shown anew.
  expect(await noted(page, "/t/b", "after swap")).toEqual({
    at: "/t/b",
    leaving: null,
    arriving: "card",
    entering: true,
    with: null,
    tone: null,
  });
  // The arrival ends like any other, and says so.
  await expect
    .poll(() => noted(page, "/t/b", "arrived"))
    .toEqual({ move: "card", entering: true, whole: true });
});

test("a move's data reaches the page swapped in: arrive, arrival(), and the CSS", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: routed({
      body: moves(`
        defineMove("tint", {
          match: ({ link }) => link.id === "to-b",
          leave: () => ({ data: { tone: "teal", hadHeader: true } }),
          arrive: (arrival) => note("arrive", arrival),
        });`),
    }),
    b: routed(),
  });
  await open(page, "/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  await expect
    .poll(() => noted(page, "/t/b", "after swap"))
    .toMatchObject({
      arriving: "tint",
      with: "hadHeader",
      tone: "teal",
    });
  expect(await noted(page, "/t/b", "arrive")).toEqual({
    move: "tint",
    via: "link",
    from: "/t/a",
    data: { tone: "teal", hadHeader: true },
    remembered: null,
    reported: null,
  });
});

test("from code, the default move plays, or the move named; data-turn=none plays none", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: routed({ body: `<a id="none" href="/t/b" data-turn="none">b</a>` }),
    b: routed(),
    c: routed(),
  });
  await open(page, "/t/a");
  await page.evaluate(() =>
    (window as { go?: (to: string) => void }).go?.("/t/b"),
  );
  await page.waitForURL("**/t/b");
  await expect
    .poll(() => noted(page, "/t/b", "after swap"))
    .toMatchObject({
      arriving: "page",
    });
  await page.evaluate(() =>
    (window as { go?: (to: string, move: string) => void }).go?.(
      "/t/c",
      "card",
    ),
  );
  await page.waitForURL("**/t/c");
  await expect
    .poll(() => noted(page, "/t/c", "after swap"))
    .toMatchObject({
      arriving: "card",
    });

  await open(page, "/t/a");
  await page.click("#none");
  await page.waitForURL("**/t/b");
  await expect
    .poll(() => noted(page, "/t/b", "after swap"))
    .toMatchObject({
      leaving: null,
      arriving: null,
      entering: true,
    });
});

test("a navigation the router gives up puts the page back, and its move is told", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: routed({
      css: LEAVE_CSS,
      body: moves(
        `defineMove("card", { stay: (turn, stay) => note("move stay", stay.reason) });`,
      ),
    }),
    b: routed(),
  });
  await open(page, "/t/a");
  await page.evaluate(() => {
    (window as { routerFails?: boolean }).routerFails = true;
  });
  await page.click("#to-b");
  await expect.poll(() => noted(page, "/t/a", "move stay")).toBe(undefined);
  await expect
    .poll(() => noted(page, "/t/a", "stay"))
    .toEqual({ move: "page", reason: "cancelled" });
  expect(page.url()).toMatch(/\/t\/a$/);
  expect(
    await page.evaluate(
      () => "turnLeaving" in document.documentElement.dataset,
    ),
  ).toBe(false);
});

test("a second navigation during a leave ends the first, which is told it was superseded", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: routed({
      body: moves(`
        defineMove("slow", {
          match: ({ link }) => link.id === "to-b",
          leave: (turn) => new Promise((done) => setTimeout(done, 800)),
          stay: (turn, stay) => note("slow stay", stay.reason),
        });`),
    }),
    b: routed(),
    c: routed(),
  });
  await open(page, "/t/a");
  await page.click("#to-b");
  await page.click("#to-c");
  await page.waitForURL("**/t/c");
  expect(await noted(page, "/t/a", "slow stay")).toBe("superseded");
  await expect.poll(() => swaps(page, "/t/c")).toHaveLength(1);
  // The first never swaps: its router saw the second start.
  await page.waitForTimeout(1000);
  expect(page.url()).toMatch(/\/t\/c$/);
  expect(await swaps(page, "/t/b")).toEqual([]);
});

test("Back plays no leave, and returns under returnAs with what was remembered and reported", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: routed({
      body: moves(`
        defineMove("card", {
          match: ({ link }) => link.id === "to-b",
          leave: () => ({ returnAs: "card-back", remember: { y: 1 } }),
        });
        defineMove("card-back", { arrive: (arrival) => note("back arrive", arrival) });
        // On Back the address has changed already: the report says what is shown.
        whenLeft(() => ({ box: 2 }));`),
    }),
    b: routed(),
  });
  await open(page, "/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  await expect.poll(() => swaps(page, "/t/b")).toHaveLength(1);
  const leaves = (await notes(page)).filter(
    (note) => note.key === "leaving",
  ).length;

  await page.goBack();
  await page.waitForURL("**/t/a");
  await expect
    .poll(() => noted(page, "/t/a", "after swap"))
    .toMatchObject({
      arriving: "card-back",
      entering: false,
    });
  expect(await noted(page, "/t/a", "back arrive")).toEqual({
    move: "card-back",
    via: "history",
    from: "/t/b",
    data: null,
    remembered: { y: 1 },
    reported: { box: 2 },
  });
  expect(
    (await notes(page)).filter((note) => note.key === "leaving"),
  ).toHaveLength(leaves);
});

test("Back after a move with no returnAs arrives plain", async ({
  page,
  context,
}) => {
  await serve(context, { a: routed(), b: routed() });
  await open(page, "/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  await expect.poll(() => swaps(page, "/t/b")).toHaveLength(1);
  await page.goBack();
  await page.waitForURL("**/t/a");
  await expect.poll(() => swaps(page, "/t/a")).toHaveLength(1);
  expect(await noted(page, "/t/a", "after swap")).toMatchObject({
    leaving: null,
    arriving: null,
    entering: false,
  });
});

test("a cancelled pageturn:leaving lets the router navigate with no move", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: routed({
      body: `<script>document.addEventListener("pageturn:leaving", (event) => event.preventDefault());</script>`,
    }),
    b: routed(),
  });
  await open(page, "/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  await expect
    .poll(() => noted(page, "/t/b", "after swap"))
    .toMatchObject({
      leaving: null,
      arriving: null,
    });
});

test("under reduced motion, the router navigates and nothing is marked", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await serve(context, { a: routed({ css: LEAVE_CSS }), b: routed() });
  await open(page, "/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  await expect
    .poll(() => noted(page, "/t/b", "after swap"))
    .toEqual({
      at: "/t/b",
      leaving: null,
      arriving: null,
      entering: false,
      with: null,
      tone: null,
    });
  expect(await noted(page, "/t/a", "leaving")).toBe(undefined);
});

test("a navigation to a place in the same page plays no move", async ({
  page,
  context,
}) => {
  await serve(context, { a: routed({ css: LEAVE_CSS }) });
  await open(page, "/t/a");
  await page.evaluate(() =>
    (window as { go?: (to: string) => void }).go?.("/t/a#below"),
  );
  await expect
    .poll(() => noted(page, "/t/a", "after swap"))
    .toMatchObject({
      leaving: null,
      arriving: null,
    });
  expect(await noted(page, "/t/a", "leaving")).toBe(undefined);
});
