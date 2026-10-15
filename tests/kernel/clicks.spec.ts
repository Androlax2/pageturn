/** Which clicks the kernel takes, and which it leaves alone. */
import { expect, test } from "@playwright/test";
import { isHandled, noted, serve } from "../support/site.ts";

test("the default move plays out, then in", async ({ page, context }) => {
  await serve(context, { a: {}, b: {} });
  await page.goto("/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/a", "leaving")).toBe("page");
  expect(await noted(page, "/t/b", "arrival")).toEqual({
    move: "page",
    via: "link",
    from: "/t/a",
    data: null,
    remembered: null,
    reported: null,
  });
  expect(await noted(page, "/t/b", "arriving")).toBe("page");
});

test("a plain load has no arrival", async ({ page, context }) => {
  await serve(context, { a: {} });
  await page.goto("/t/a");
  expect(await noted(page, "/t/a", "arrival")).toBeNull();
  expect(await noted(page, "/t/a", "arriving")).toBeNull();
});

for (const [modifier, init] of [
  ["Control", { ctrlKey: true }],
  ["Meta", { metaKey: true }],
  ["Shift", { shiftKey: true }],
  ["Alt", { altKey: true }],
  ["a middle button", { button: 1 }],
] as const) {
  test(`a click with ${modifier} is left alone`, async ({ page, context }) => {
    await serve(context, { a: {}, b: {} });
    await page.goto("/t/a");
    expect(await isHandled(page, "#to-b", init)).toBe(false);
  });
}

test("a click already handled by the page is left alone, even by a listener added after the kernel", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: {
      script: `addEventListener("click", (event) => event.preventDefault());`,
    },
    b: {},
  });
  await page.goto("/t/a");
  await page.click("#to-b");
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(/\/t\/a$/);
  expect(await noted(page, "/t/a", "leaving")).toBeUndefined();
});

test("a link in editable content is left alone", async ({ page, context }) => {
  await serve(context, {
    a: { body: `<div contenteditable><a id="edit" href="/t/b">b</a></div>` },
    b: {},
  });
  await page.goto("/t/a");
  expect(await isHandled(page, "#edit")).toBe(false);
});

test("a link inside a shadow root plays the move", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: {
      body: `<div id="host"></div>`,
      script: `document.getElementById("host").attachShadow({ mode: "open" }).innerHTML =
        '<a id="shadowed" href="/t/b">in the shadow</a>';`,
    },
    b: {},
  });
  await page.goto("/t/a");
  await page.locator("#shadowed").click();
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/a", "leaving")).toBe("page");
  expect(await noted(page, "/t/b", "arriving")).toBe("page");
});

const ignored: Record<string, string> = {
  "an SVG link": `<svg width="40" height="40"><a id="link" href="/t/b"><rect width="40" height="40"/></a></svg>`,
  "a link to another origin": `<a id="link" href="https://example.com/">away</a>`,
  "a link with a target": `<a id="link" href="/t/b" target="_blank">b</a>`,
  "a download link": `<a id="link" href="/t/b" download>b</a>`,
  "a link to the same page": `<a id="link" href="/t/a#below">below</a>`,
  "a link without href": `<a id="link">nowhere</a>`,
  "a link opted out": `<a id="link" href="/t/b" data-turn="none">b</a>`,
  "a link in an opted-out ancestor": `<nav data-turn="none"><a id="link" href="/t/b">b</a></nav>`,
};

for (const [what, body] of Object.entries(ignored)) {
  test(`${what} is left alone`, async ({ page, context }) => {
    await serve(context, { a: { body }, b: {} });
    await page.goto("/t/a");
    expect(await isHandled(page, "#link")).toBe(false);
  });
}

test("a link with target _self plays the move", async ({ page, context }) => {
  await serve(context, {
    a: { body: `<a id="link" href="/t/b" target="_self">b</a>` },
    b: {},
  });
  await page.goto("/t/a");
  expect(await isHandled(page, "#link")).toBe(true);
});

test("an opted-out link navigates normally and arrives plain", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: { body: `<a id="link" href="/t/b" data-turn="none">b</a>` },
    b: {},
  });
  await page.goto("/t/a");
  await page.click("#link");
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/b", "arrival")).toBeNull();
});

test("under reduced motion, nothing plays and nothing is marked", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await serve(context, { a: {}, b: {} });
  await page.goto("/t/a");
  expect(await isHandled(page, "#to-b")).toBe(false);
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/b", "arrival")).toBeNull();
  expect(await noted(page, "/t/b", "arriving")).toBeNull();
});

test("a stale mark is deleted under reduced motion", async ({
  page,
  context,
}) => {
  await serve(context, { a: {}, b: {} });
  await page.goto("/t/a");
  await page.evaluate(() =>
    sessionStorage.setItem(
      "pageturn",
      JSON.stringify({
        move: "page",
        data: null,
        from: "/t/x",
        at: Date.now(),
      }),
    ),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/t/b");
  expect(await page.evaluate(() => sessionStorage.getItem("pageturn"))).toBe(
    null,
  );
});

test("a mark older than 10 s is ignored", async ({ page, context }) => {
  await serve(context, { a: {}, b: {} });
  await page.goto("/t/a");
  await page.evaluate(() =>
    sessionStorage.setItem(
      "pageturn",
      JSON.stringify({
        move: "page",
        data: null,
        from: "/t/a",
        at: Date.now() - 11_000,
      }),
    ),
  );
  await page.goto("/t/b");
  expect(await noted(page, "/t/b", "arrival")).toBeNull();
});

test("a page in an iframe is inert and leaves the mark to the top page", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: {},
    b: { body: `<iframe src="/t/c"></iframe>` },
    c: {},
  });
  await page.goto("/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  await page.frameLocator("iframe").locator("h1").waitFor();
  expect(await noted(page, "/t/b", "arrival")).toMatchObject({ move: "page" });
  expect(await noted(page, "/t/c", "arrival")).toBeNull();
  expect(await noted(page, "/t/c", "arriving")).toBeNull();
});

test("a click while a move plays is ignored", async ({ page, context }) => {
  await serve(context, {
    a: {
      script: `pageturn.defineMove("page", {
        leave: () => new Promise((resolve) => setTimeout(resolve, 500)),
      });`,
    },
    b: {},
    c: {},
  });
  await page.goto("/t/a");
  await page.click("#to-b");
  expect(await isHandled(page, "#to-c")).toBe(true);
  await page.waitForURL("**/t/b");
});

test("three clicks sent from script play one move", async ({
  page,
  context,
}) => {
  await serve(context, { a: {}, b: {} });
  await page.goto("/t/a");
  await page.evaluate(() => {
    document.addEventListener("pageturn:leaving", () => note("leave event", 1));
    const link = document.getElementById("to-b");
    link?.click();
    link?.click();
    link?.click();
  });
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/b", "arriving")).toBe("page");
  const leaves = await page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("test-notes") || "[]").filter(
        (note: { key: string }) => note.key === "leave event",
      ).length,
  );
  expect(leaves).toBe(1);
});

test("a click from the keyboard plays the move", async ({ page, context }) => {
  await serve(context, { a: {}, b: {} });
  await page.goto("/t/a");
  await page.focus("#to-b");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/a", "leaving")).toBe("page");
  expect(await noted(page, "/t/b", "arriving")).toBe("page");
});

test("prefetch: a press asks for the page once", async ({ page, context }) => {
  const site = await serve(context, { a: {}, b: {} });
  await page.goto("/t/a");
  const press = () =>
    page.evaluate(() =>
      document
        .getElementById("to-b")
        ?.dispatchEvent(
          new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
        ),
    );
  await press();
  await press();
  const usesLink = await page.evaluate(() =>
    document.createElement("link").relList.supports("prefetch"),
  );
  if (usesLink) {
    expect(
      await page.locator('link[rel="prefetch"][href$="/t/b"]').count(),
    ).toBe(1);
  } else {
    await expect.poll(() => site.requests.get("b")).toBe(1);
  }
});

test("prefetch: none when switched off", async ({ page, context }) => {
  const site = await serve(context, {
    a: { script: `pageturn.configure({ prefetch: false });` },
    b: {},
  });
  await page.goto("/t/a");
  await page.evaluate(() =>
    document
      .getElementById("to-b")
      ?.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
      ),
  );
  await page.waitForTimeout(300);
  expect(await page.locator('link[rel="prefetch"]').count()).toBe(0);
  expect(site.requests.get("b")).toBeUndefined();
});

test("the kernel installs once when loaded twice", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: { head: `<script src="/dist/pageturn.js"></script>` },
    b: {},
  });
  await page.goto("/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/b", "arrival")).toMatchObject({ move: "page" });
});

test("a link to the same page with another query plays the move; one to a place in it does not", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: {
      body: `<a id="next" href="/t/a?page=2">page 2</a><a id="place" href="#far">far</a><a id="here" href="/t/a?page=1#far">far</a>`,
    },
  });
  // A page each: a click handled starts a turn, and the lock holds the next.
  for (const [link, isAMove] of [
    ["#next", true],
    ["#place", false],
    ["#here", false],
  ] as const) {
    await page.goto("/t/a?page=1");
    expect(await isHandled(page, link)).toBe(isAMove);
  }
});

test("a link a <base target> sends elsewhere is left to the browser", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: {
      head: `<base target="_blank">`,
      body: `<a id="link" href="/t/b">b</a>`,
    },
    b: {},
  });
  await page.goto("/t/a");
  expect(await isHandled(page, "#link")).toBe(false);
});

test("a mark is taken only by the page it was left for, and not on a reload", async ({
  page,
  context,
}) => {
  await serve(context, { a: {}, b: { stays: true }, c: {} });
  await page.goto("/t/a");
  // The navigation never completes: the mark is kept, for 10 s.
  await page.evaluate(() => document.getElementById("to-b")?.click());
  await page.waitForTimeout(500);
  await page.goto("/t/c");
  expect(await noted(page, "/t/c", "arriving")).toBeNull();

  await page.goto("/t/a");
  await page.evaluate(() => document.getElementById("to-b")?.click());
  await page.waitForTimeout(500);
  await page.reload();
  expect(await noted(page, "/t/a", "arriving")).toBeNull();
});

test("a link redirected on its way (a trailing slash added) still arrives by its move", async ({
  page,
  context,
}) => {
  // Playwright does not route the request a redirect leads to: the redirect is said by
  // the navigation's timing instead, as the browser says it, before the head script runs.
  await context.addInitScript(() => {
    if (location.pathname !== "/t/b") return;
    const real = performance.getEntriesByType.bind(performance);
    // Its two fields the head script reads; the entry's own are getters, not to be set.
    performance.getEntriesByType = ((type: string) =>
      type === "navigation"
        ? [{ type: "navigate", redirectCount: 1 }]
        : real(type)) as typeof performance.getEntriesByType;
  });
  await serve(context, {
    a: {
      body: `<a id="old" href="/t/old" data-turn="card">old</a>`,
      // The link leads to /t/old; the server answers /t/b.
      script: `document.getElementById("old").addEventListener("click", () =>
        setTimeout(() => location.replace("/t/b"), 500));`,
    },
    b: {},
    old: { stays: true },
  });
  await page.goto("/t/a");
  await page.click("#old");
  // Not waitForURL: WebKit reports the 204 as an aborted navigation, which it fails on.
  await expect(page).toHaveURL(/\/t\/b$/);
  await page.waitForLoadState("load");
  expect(await noted(page, "/t/b", "arriving")).toBe("card");
});
