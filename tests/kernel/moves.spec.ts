/** Moves, choosers, their outcomes, and the two timeouts. */
import { expect, type Page, test } from "@playwright/test";
import { noted, notes, type Site, serve } from "../support/site.ts";

const FADE = `@keyframes fade { to { opacity: 0 } }`;

/** Clicks and gives how long the destination took to be asked for. */
async function timeTo(page: Page, site: Site, name: string): Promise<number> {
  const clickedAt = Date.now();
  await page.click(`#to-${name}`);
  await page.waitForURL(`**/t/${name}`);
  return (site.requestedAt.get(name) ?? Number.NaN) - clickedAt;
}

test("a data-turn attribute names the move, and a CSS-only move plays both halves", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: { body: `<a id="card" href="/t/b" data-turn="card">card</a>` },
    b: {},
  });
  await page.goto("/t/a");
  await page.click("#card");
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/a", "leaving")).toBe("card");
  expect(await noted(page, "/t/b", "arriving")).toBe("card");
});

test("choosers are asked in order and the attribute wins over them", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: {
      body: `<a id="named" href="/t/b" data-turn="named">b</a>`,
      script: `
        pageturn.chooseMove(() => undefined);
        pageturn.chooseMove(({ to }) => to.pathname === "/t/b" ? "first" : undefined);
        pageturn.chooseMove(() => "second");`,
    },
    b: {},
    c: {},
  });
  await page.goto("/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/b", "arriving")).toBe("first");

  await page.goto("/t/a");
  await page.click("#to-c");
  await page.waitForURL("**/t/c");
  expect(await noted(page, "/t/c", "arriving")).toBe("second");

  await page.goto("/t/a");
  await page.click("#named");
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/b", "arriving")).toBe("named");
});

test("a chooser answering null gives a normal navigation", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: { script: `pageturn.chooseMove(() => null);` },
    b: {},
  });
  await page.goto("/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/a", "leaving")).toBeUndefined();
  expect(await noted(page, "/t/b", "arrival")).toBeNull();
});

test("no default move: unchosen links navigate normally", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: { script: `pageturn.configure({ defaultMove: null });` },
    b: {},
  });
  await page.goto("/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/b", "arrival")).toBeNull();
});

test("a move that declines gives way to the default move", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: {
      body: `<a id="card" href="/t/b" data-turn="card">card</a>`,
      script: `pageturn.defineMove("card", { leave: (turn) => turn.decline() });`,
    },
    b: {},
  });
  await page.goto("/t/a");
  await page.click("#card");
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/a", "leaving")).toBe("page");
  expect(await noted(page, "/t/b", "arriving")).toBe("page");
});

test("a leave that answers nothing gets its CSS half and its mark", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: {
      body: `<a id="card" href="/t/b" data-turn="card">card</a>`,
      script: `pageturn.defineMove("card", { leave() {} });`,
    },
    b: {},
  });
  await page.goto("/t/a");
  await page.click("#card");
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/a", "leaving")).toBe("card");
  expect(await noted(page, "/t/b", "arriving")).toBe("card");
});

test("a handover reaches the next page, from the head and from a script", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: {
      body: `<a id="card" href="/t/b" data-turn="card">card</a>`,
      script: `pageturn.defineMove("card", {
        async leave(turn) {
          await turn.leaving();
          return { data: { left: 12, canHandOver: turn.canHandOver, move: turn.move } };
        },
      });`,
    },
    b: {
      head: `<script>note("head saw", window.pageturn.arrival);</script>`,
    },
  });
  await page.goto("/t/a");
  await page.click("#card");
  await page.waitForURL("**/t/b");
  const expected = {
    move: "card",
    via: "link",
    from: "/t/a",
    data: { left: 12, canHandOver: true, move: "card" },
    remembered: null,
    reported: null,
  };
  expect(await noted(page, "/t/b", "head saw")).toEqual(expected);
  expect(await page.evaluate(() => window.pageturn?.arrival)).toEqual(expected);
});

test("arriveAs renames the arrival, and null leaves no mark", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: {
      body: `<a id="renamed" href="/t/b" data-turn="renamed">b</a>
             <a id="unmarked" href="/t/c" data-turn="unmarked">c</a>`,
      script: `
        pageturn.defineMove("renamed", { leave: () => ({ arriveAs: "other" }) });
        pageturn.defineMove("unmarked", { leave: () => ({ arriveAs: null }) });`,
    },
    b: {},
    c: {},
  });
  await page.goto("/t/a");
  await page.click("#renamed");
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/b", "arriving")).toBe("other");
  await page.goto("/t/a");
  await page.click("#unmarked");
  await page.waitForURL("**/t/c");
  expect(await noted(page, "/t/c", "arrival")).toBeNull();
});

test("the leave waits for its CSS animation", async ({ page, context }) => {
  const site = await serve(context, {
    a: {
      css: `html:root[data-turn-leaving="page"] main { animation: fade 600ms both } ${FADE}`,
    },
    b: {},
  });
  await page.goto("/t/a");
  const took = await timeTo(page, site, "b");
  expect(took).toBeGreaterThanOrEqual(550);
  expect(took).toBeLessThan(2000);
});

test("the leave waits for a CSS transition and a pseudo-element", async ({
  page,
  context,
}) => {
  const site = await serve(context, {
    a: {
      css: `main { transition: opacity 500ms }
        html:root[data-turn-leaving="page"] main { opacity: 0 }
        html::before { content: ""; display: block; height: 2px }
        html:root[data-turn-leaving="page"]::before { animation: fade 700ms both } ${FADE}`,
    },
    b: {},
  });
  await page.goto("/t/a");
  const took = await timeTo(page, site, "b");
  expect(took).toBeGreaterThanOrEqual(650);
});

test("a leave longer than the ceiling is cut, and navigates unmarked", async ({
  page,
  context,
}) => {
  const site = await serve(context, {
    a: {
      css: `html:root[data-turn-leaving="page"] main { animation: fade 10s both } ${FADE}`,
      script: `pageturn.configure({ leaveTimeout: 800 });`,
    },
    b: {},
  });
  await page.goto("/t/a");
  const took = await timeTo(page, site, "b");
  expect(took).toBeGreaterThanOrEqual(750);
  expect(took).toBeLessThan(3000);
});

test("a leave in code longer than the ceiling navigates unmarked", async ({
  page,
  context,
}) => {
  const site = await serve(context, {
    a: {
      body: `<a id="slow" href="/t/b" data-turn="slow">slow</a>`,
      script: `pageturn.configure({ leaveTimeout: 500 });
        pageturn.defineMove("slow", { leave: () => new Promise(() => {}) });`,
    },
    b: {},
  });
  await page.goto("/t/a");
  const clickedAt = Date.now();
  await page.click("#slow");
  await page.waitForURL("**/t/b");
  expect((site.requestedAt.get("b") ?? 0) - clickedAt).toBeGreaterThanOrEqual(
    450,
  );
  expect(await noted(page, "/t/b", "arrival")).toBeNull();
});

test("an infinite animation is not waited for", async ({ page, context }) => {
  const site = await serve(context, {
    a: {
      css: `html:root[data-turn-leaving="page"] main { animation: fade 1s infinite } ${FADE}`,
    },
    b: {},
  });
  await page.goto("/t/a");
  expect(await timeTo(page, site, "b")).toBeLessThan(700);
});

test("with no animation to wait for, it navigates at once", async ({
  page,
  context,
}) => {
  const site = await serve(context, { a: { sheet: "none" }, b: {} });
  await page.goto("/t/a");
  expect(await timeTo(page, site, "b")).toBeLessThan(500);
  expect(await noted(page, "/t/b", "arriving")).toBe("page");
});

test("a leave that throws navigates unmarked", async ({ page, context }) => {
  await serve(context, {
    a: {
      script: `pageturn.defineMove("page", { leave() { throw new Error("broken"); } });`,
    },
    b: {},
  });
  await page.goto("/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/b", "arrival")).toBeNull();
});

test("a stuck navigation is restored once, with its event", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: {
      script: `pageturn.configure({ stuckTimeout: 300 });
        pageturn.defineMove("page", {
          leave: (turn) => turn.leaving().then(() => ({ data: 1 })),
          stay: (turn, stay) => note("restore", { move: turn.move, ...stay }),
        });`,
    },
    b: { stays: true },
  });
  await page.goto("/t/a");
  await page.click("#to-b");
  await expect
    .poll(() => noted(page, "/t/a", "stay"), { timeout: 5000 })
    .toEqual({ move: "page", reason: "stuck" });
  expect(await noted(page, "/t/a", "restore")).toEqual({
    move: "page",
    reason: "stuck",
    handover: { data: 1 },
  });
  expect(
    await page.evaluate(() => document.documentElement.dataset.turnLeaving),
  ).toBeUndefined();
  // The mark outlives the timer: the page may still come (next test).
  expect(
    await page.evaluate(() => sessionStorage.getItem("pageturn")),
  ).not.toBeNull();
  await page.waitForTimeout(500);
  const restores = await page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("test-notes") || "[]").filter(
        (note: { key: string }) => note.key === "restore",
      ).length,
  );
  expect(restores).toBe(1);
});

test("a page that comes after the stuck timer still arrives by its move", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: { script: `pageturn.configure({ stuckTimeout: 300 });` },
    b: {},
  });
  await context.route("**/t/b", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.fallback();
  });
  await page.goto("/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/a", "stay")).toEqual({
    move: "page",
    reason: "stuck",
  });
  expect(await noted(page, "/t/b", "arriving")).toBe("page");
});

test("a mark left by a navigation that never completed does not follow the next click", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: {
      body: `<a id="plain" href="/t/c" data-turn="none">plain</a>`,
      script: `pageturn.configure({ stuckTimeout: 200 });`,
    },
    b: { stays: true },
    c: {},
  });
  await page.goto("/t/a");
  await page.click("#to-b");
  await expect
    .poll(() => noted(page, "/t/a", "stay"))
    .toEqual({ move: "page", reason: "stuck" });
  await page.evaluate(() => document.getElementById("plain")?.click());
  await page.waitForURL("**/t/c");
  expect(await noted(page, "/t/c", "arrival")).toBeNull();
});

test("the data's strings and numbers are custom properties on the root while the page arrives", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: {
      script: `pageturn.defineMove("page", {
        leave: (turn) => turn.leaving().then(() => ({
          data: { tone: "rgb(1, 2, 3)", count: 3, isOpen: true, nested: { no: 1 } },
        })),
      });`,
    },
    b: {
      head: `<script>
        const style = document.documentElement.style;
        note("carried", ["--turn-tone", "--turn-count", "--turn-isOpen", "--turn-nested"].map((name) => style.getPropertyValue(name)));
      </script>`,
    },
  });
  await page.goto("/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  // In the head, before the first frame: only what CSS can read as it is.
  expect(await noted(page, "/t/b", "carried")).toEqual([
    "rgb(1, 2, 3)",
    "3",
    "",
    "",
  ]);
  // They go with the arrival.
  expect(
    await page.evaluate(() => {
      window.pageturn?.endArrival();
      return document.documentElement.style.getPropertyValue("--turn-tone");
    }),
  ).toBe("");
});

test("cancelling pageturn:leave gives a normal navigation", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: {
      script: `document.addEventListener("pageturn:leaving", (event) => {
        note("leave event", event.detail.move);
        event.preventDefault();
      });`,
    },
    b: {},
  });
  await page.goto("/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/a", "leave event")).toBe("page");
  expect(await noted(page, "/t/a", "leaving")).toBeUndefined();
  expect(await noted(page, "/t/b", "arrival")).toBeNull();
});

test("pageturn:leave fires once when a move declines", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: {
      body: `<a id="card" href="/t/b" data-turn="card">card</a>`,
      script: `
        pageturn.defineMove("card", { leave: (turn) => turn.decline() });
        document.addEventListener("pageturn:leaving", (event) => note("leave event", event.detail.move));`,
    },
    b: {},
  });
  await page.goto("/t/a");
  await page.click("#card");
  await page.waitForURL("**/t/b");
  const events = await page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("test-notes") || "[]").filter(
        (note: { key: string }) => note.key === "leave event",
      ).length,
  );
  expect(events).toBe(1);
});

test("without storage, the move still plays and the next page arrives plain", async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
  });
  await serve(context, {
    a: {
      body: `<a id="card" href="/t/b" data-turn="card">card</a>`,
      script: `pageturn.defineMove("card", {
        leave(turn) { window.name = "can hand over: " + turn.canHandOver; return turn.leaving(); },
      });`,
    },
    b: {},
  });
  // Notes need storage: window.name carries the answer across the navigation instead.
  await page.goto("/t/a");
  await page.click("#card");
  await page.waitForURL("**/t/b");
  expect(await page.evaluate(() => window.name)).toBe("can hand over: false");
  expect(await page.evaluate(() => window.pageturn?.arrival)).toBeNull();
});

test("data-turn-root moves in place of main", async ({ page, context }) => {
  await serve(context, {
    a: {
      body: `<section data-turn-root id="root">moves</section>`,
      css: `:root { --turn-leave-duration: 2s }`,
    },
    b: {},
  });
  await page.goto("/t/a");
  await page.click("#to-b");
  const targets = await page.evaluate(() =>
    document
      .getAnimations()
      .map(
        (animation) =>
          ((animation.effect as KeyframeEffect).target as Element).localName,
      ),
  );
  expect(targets).toEqual(["section"]);
});

test("arrive is told on the page reached under the move's name, once, and only then", async ({
  page,
  context,
}) => {
  const B = `pageturn.defineMove("card", {
    arrive: (arrival) => note("arrive", arrival.data),
  });`;
  await serve(context, {
    a: {
      body: `<a id="card" href="/t/b" data-turn="card">card</a>`,
      script: `pageturn.defineMove("card", { leave: () => ({ data: { tone: "red" } }) });`,
    },
    b: { script: B },
  });
  await page.goto("/t/a");
  await page.click("#card");
  await page.waitForURL("**/t/b");
  await expect
    .poll(() => noted(page, "/t/b", "arrive"))
    .toEqual({ tone: "red" });
  // Reached by another move, or none: not told.
  await page.goto("/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  await page.waitForTimeout(200);
  expect(
    (await notes(page)).filter((note) => note.key === "arrive"),
  ).toHaveLength(1);
});

/** How many notes of that key the pages have left. */
const count = (page: Page, key: string): Promise<number> =>
  page.evaluate(
    (key) =>
      JSON.parse(sessionStorage.getItem("test-notes") || "[]").filter(
        (note: { key: string }) => note.key === key,
      ).length,
    key,
  );

test.describe("a move's own match", () => {
  test("plays the move for the links it matches, and only those", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: {
        script: `pageturn.defineMove("card", { match: ({ link }) => link.id === "to-b" });`,
      },
      b: {},
      c: {},
    });
    await page.goto("/t/a");
    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    expect(await noted(page, "/t/b", "arriving")).toBe("card");
    await page.goto("/t/a");
    await page.click("#to-c");
    await page.waitForURL("**/t/c");
    expect(await noted(page, "/t/c", "arriving")).toBe("page");
  });

  test("is not asked when the link names its move", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: {
        body: `<a id="named" href="/t/b" data-turn="card">b</a>`,
        script: `pageturn.defineMove("card", { match: () => { note("asked", true); return false; } });`,
      },
      b: {},
    });
    await page.goto("/t/a");
    await page.click("#named");
    await page.waitForURL("**/t/b");
    expect(await noted(page, "/t/b", "arriving")).toBe("card");
    expect(await count(page, "asked")).toBe(0);
  });

  test("comes after the choosers: one answering null or a name wins", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: {
        script: `
          pageturn.defineMove("card", { match: () => true });
          pageturn.chooseMove(({ to }) => to.pathname === "/t/b" ? null : undefined);
          pageturn.chooseMove(({ to }) => to.pathname === "/t/c" ? "chosen" : undefined);`,
      },
      b: {},
      c: {},
      d: {},
    });
    for (const [to, expected] of [
      ["b", null],
      ["c", "chosen"],
      ["d", "card"],
    ] as const) {
      await page.goto("/t/a");
      await page.click(`#to-${to}`);
      await page.waitForURL(`**/t/${to}`);
      expect(await noted(page, `/t/${to}`, "arriving")).toBe(expected);
    }
  });

  test("is asked in the order the moves were defined", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: {
        script: `
          pageturn.defineMove("first", { match: () => true });
          pageturn.defineMove("second", { match: () => true });`,
      },
      b: {},
    });
    await page.goto("/t/a");
    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    expect(await noted(page, "/t/b", "arriving")).toBe("first");
  });

  test("a match that throws leaves the default move to play", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: {
        script: `pageturn.defineMove("card", { match() { throw new Error("broken"); } });`,
      },
      b: {},
    });
    await page.goto("/t/a");
    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    expect(await noted(page, "/t/b", "arriving")).toBe("page");
  });
});

test.describe("stay sees what leave answered", () => {
  test("null when the page was left unmarked, at the ceiling", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: {
        body: `<a id="slow" href="/t/b" data-turn="slow">b</a>`,
        script: `pageturn.configure({ leaveTimeout: 300, stuckTimeout: 300 });
          pageturn.defineMove("slow", {
            leave: () => new Promise(() => {}),
            stay: (turn, stay) => note("restore", stay),
          });`,
      },
      b: { stays: true },
    });
    await page.goto("/t/a");
    await page.evaluate(() => document.getElementById("slow")?.click());
    await page.waitForTimeout(1200);
    expect(await noted(page, "/t/a", "restore")).toEqual({
      reason: "stuck",
      handover: null,
    });
  });
});

test.describe("turn.decline()", () => {
  test("declines: the default move plays", async ({ page, context }) => {
    await serve(context, {
      a: {
        body: `<a id="card" href="/t/b" data-turn="card">card</a>`,
        script: `pageturn.defineMove("card", { leave: (turn) => turn.decline() });`,
      },
      b: {},
    });
    await page.goto("/t/a");
    await page.click("#card");
    await page.waitForURL("**/t/b");
    expect(await noted(page, "/t/a", "leaving")).toBe("page");
    expect(await noted(page, "/t/b", "arriving")).toBe("page");
  });
});

test.describe("--turn-leave-max", () => {
  for (const cap of ["300ms", "0.3s"]) {
    test(`caps the wait at ${cap}, and the animation plays on`, async ({
      page,
      context,
    }) => {
      const site = await serve(context, {
        a: {
          css: `html:root[data-turn-leaving="page"] main { animation: fade 3s both }
            html[data-turn-leaving="page"] { --turn-leave-max: ${cap} } ${FADE}`,
        },
        b: { stays: true },
      });
      await page.goto("/t/a");
      const clickedAt = Date.now();
      await page.evaluate(() => document.getElementById("to-b")?.click());
      await page.waitForTimeout(900);
      const took = (site.requestedAt.get("b") ?? Number.NaN) - clickedAt;
      expect(took).toBeGreaterThanOrEqual(250);
      expect(took).toBeLessThan(800);
      // Cut is the wait, not the animation.
      expect(
        await page.evaluate(
          () =>
            document
              .querySelector("main")
              ?.getAnimations()
              .filter((animation) => animation.playState === "running").length,
        ),
      ).toBe(1);
    });
  }
});
