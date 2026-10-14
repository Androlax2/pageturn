/**
 * How an arrival ends, the page shown anew, what it carries
 * for CSS, and pageturn:arrived.
 */
import { expect, type Page, test } from "@playwright/test";
import { noted, serve } from "../support/site.ts";

/** Notes pageturn:arrived, and whether the page was marked shown anew from the head on. */
const WATCH = `<script>
  note("entering", "turnEntering" in document.documentElement.dataset);
  document.addEventListener("pageturn:arrived", (event) => note("arrived", event.detail));
</script>`;

const RISE = `@keyframes rise { from { opacity: 0 } }`;

const marks = (page: Page) =>
  page.evaluate(() => {
    const { dataset, style } = document.documentElement;
    return {
      arriving: dataset.turnArriving ?? null,
      entering: "turnEntering" in dataset,
      with: dataset.turnWith ?? null,
      tone: style.getPropertyValue("--turn-tone") || null,
    };
  });

test.describe("the arrival ends with its animations", () => {
  test("those of the CSS and those of a script, one started after another", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: {},
      b: {
        head: WATCH,
        css: `[data-turn-arriving="page"] main { animation: rise 400ms both } ${RISE}`,
        // Started as the first ends: waited for too.
        script: `document.querySelector("main").addEventListener("animationend", () =>
          document.querySelector("h1").animate({ opacity: [0, 1] }, 400), { once: true });`,
      },
    });
    await page.goto("/t/a");
    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    await page.waitForTimeout(600);
    expect((await marks(page)).arriving).toBe("page");
    await expect
      .poll(() => noted(page, "/t/b", "arrived"))
      .toEqual({ move: "page", entering: true, whole: true });
    expect(await marks(page)).toMatchObject({
      arriving: null,
      entering: false,
    });
  });

  test("not a CSS transition, not an infinite animation", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: {},
      b: {
        head: WATCH,
        css: `main { transition: opacity 5s } .dim main { opacity: 0.5 }
          h1 { animation: rise 1s infinite }`,
        script: `addEventListener("DOMContentLoaded", () => document.documentElement.classList.add("dim"));`,
      },
    });
    await page.goto("/t/a");
    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    await expect
      .poll(() => noted(page, "/t/b", "arrived"), { timeout: 2000 })
      .toEqual({ move: "page", entering: true, whole: true });
  });

  test("--turn-arrive-max cuts the wait", async ({ page, context }) => {
    await serve(context, {
      a: {},
      b: {
        head: WATCH,
        css: `:root { --turn-arrive-max: 300ms }
          [data-turn-arriving="page"] main { animation: rise 5s both } ${RISE}`,
      },
    });
    await page.goto("/t/a");
    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    await expect
      .poll(() => noted(page, "/t/b", "arrived"), { timeout: 2000 })
      .toEqual({ move: "page", entering: true, whole: true });
  });

  test('arrivalEnds "manually": the page ends it, and it played whole', async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: {},
      b: {
        head: WATCH,
        script: `pageturn.configure({ arrivalEnds: "manually" });`,
      },
    });
    await page.goto("/t/a");
    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    await page.waitForTimeout(300);
    expect(await marks(page)).toMatchObject({
      arriving: "page",
      entering: true,
    });
    await page.evaluate(() => window.pageturn?.endArrival());
    await expect
      .poll(() => noted(page, "/t/b", "arrived"))
      .toEqual({ move: "page", entering: true, whole: true });
  });

  test("cut short by endArrival(), or by the page removing the mark itself", async ({
    page,
    context,
  }) => {
    const b = {
      head: WATCH,
      css: `[data-turn-arriving="page"] main { animation: rise 800ms both } ${RISE}`,
    };
    await serve(context, { a: {}, b, c: b });
    await page.goto("/t/a");
    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    await page.evaluate(() => window.pageturn?.endArrival());
    await expect
      .poll(() => noted(page, "/t/b", "arrived"))
      .toEqual({ move: "page", entering: true, whole: false });

    // The attribute alone: the kernel still ends what is left, the page shown anew.
    await page.goto("/t/a");
    await page.click("#to-c");
    await page.waitForURL("**/t/c");
    await page.evaluate(() => {
      delete document.documentElement.dataset.turnArriving;
    });
    expect((await marks(page)).entering).toBe(true);
    await expect
      .poll(() => noted(page, "/t/c", "arrived"))
      .toEqual({ move: "page", entering: true, whole: false });
    expect((await marks(page)).entering).toBe(false);
  });

  test("a leave ends the arrival before it starts", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: {},
      b: {
        head: `${WATCH}<script>
          new MutationObserver(() => {
            const { dataset } = document.documentElement;
            if (dataset.turnLeaving) note("arriving as it leaves", dataset.turnArriving ?? null);
          }).observe(document.documentElement, { attributeFilter: ["data-turn-leaving"] });
        </script>`,
        css: `[data-turn-arriving="page"] main { animation: rise 5s both } ${RISE}`,
      },
      c: {},
    });
    await page.goto("/t/a");
    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    await page.waitForTimeout(200);
    await page.click("#to-c");
    await page.waitForURL("**/t/c");
    expect(await noted(page, "/t/b", "arriving as it leaves")).toBeNull();
    expect(await noted(page, "/t/b", "arrived")).toEqual({
      move: "page",
      entering: true,
      whole: false,
    });
  });
});

test.describe("data-turn-entering: the page shown anew", () => {
  test("by a link and by the address, with or without a move, not by Back", async ({
    page,
    context,
  }) => {
    await serve(context, { a: { head: WATCH }, b: { head: WATCH } });
    await page.goto("/t/a");
    expect(await noted(page, "/t/a", "entering")).toBe(true);
    // No move, no animation: it ends at once.
    await expect
      .poll(() => noted(page, "/t/a", "arrived"))
      .toEqual({ move: null, entering: true, whole: true });

    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    expect(await noted(page, "/t/b", "entering")).toBe(true);

    await page.goBack();
    await page.waitForURL("**/t/a");
    await page.waitForFunction(() => document.readyState === "complete");
    expect(await noted(page, "/t/a", "entering")).toBe(false);
  });

  test("not under reduced motion, not in a frame", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: { head: WATCH, body: `<iframe src="/t/b"></iframe>` },
      b: { head: WATCH },
    });
    await page.goto("/t/a");
    await page.frameLocator("iframe").locator("h1").waitFor();
    expect(await noted(page, "/t/b", "entering")).toBe(false);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/t/b");
    expect(await noted(page, "/t/b", "entering")).toBe(false);
  });

  test("not a page loaded already scrolled, from the first frame it is drawn scrolled", async ({
    page,
    context,
  }) => {
    // Every frame, as it is about to be drawn: never scrolled and still marked. Looked at
    // after the frame's layout, by an observer made after the head script's, which the
    // browser calls after it, just before painting.
    const SAMPLES = `<script>
      (function frame() {
        const look = new ResizeObserver(() => {
          look.disconnect();
          if (
            !window.sampled &&
            scrollY > 0 &&
            "turnEntering" in document.documentElement.dataset
          ) {
            note("drawn scrolled, entering", scrollY);
          }
        });
        look.observe(document.documentElement);
        if (performance.now() < 4000) requestAnimationFrame(frame);
      })();
    </script>`;
    // A script that is slow to come holds the parser: frames are drawn meanwhile.
    await context.route("**/slow.js", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({ contentType: "text/javascript", body: "" });
    });
    await serve(context, {
      a: {
        head: `${WATCH}${SAMPLES}`,
        css: `[data-turn-entering] main { animation: rise 5s both } ${RISE}`,
        body: `<div style="height: 3000px"></div><p id="far">far</p><script src="/slow.js"></script><div style="height: 3000px"></div>`,
      },
    });
    // By a link to a place in it.
    await page.goto("/t/a#far");
    await page.waitForFunction(() => document.readyState === "complete");
    expect(await noted(page, "/t/a", "entering")).toBe(true);
    await expect.poll(async () => (await marks(page)).entering).toBe(false);
    await page.waitForTimeout(300);
    expect(
      await noted(page, "/t/a", "drawn scrolled, entering"),
    ).toBeUndefined();

    // Reloaded where it was scrolled.
    await page.goto("/t/a");
    await page.waitForFunction(() => document.readyState === "complete");
    // Scrolled once loaded: the visitor's, and the mark rightly stays. Only the reload is
    // looked at.
    await page.evaluate(() => scrollTo(0, 2000));
    // This page samples no more: only the page reloaded is looked at.
    await page.evaluate(() => {
      (window as { sampled?: boolean }).sampled = true;
      sessionStorage.setItem("test-notes", "[]");
    });
    await page.reload();
    await page.waitForFunction(() => document.readyState === "complete");
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await expect.poll(async () => (await marks(page)).entering).toBe(false);
    await page.waitForTimeout(300);
    expect(
      await noted(page, "/t/a", "drawn scrolled, entering"),
    ).toBeUndefined();
  });

  test("scrolled by the visitor as it arrives, the page is still entering", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: {
        head: WATCH,
        css: `[data-turn-entering] main { animation: rise 3s both } ${RISE}`,
        body: `<div style="height: 6000px"></div>`,
      },
    });
    await page.goto("/t/a");
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    expect((await marks(page)).entering).toBe(true);
  });
});

test.describe("data-turn-with: the keys that are true", () => {
  const CARD = `pageturn.defineMove("card", {
    leave: () => ({ data: { hadHeader: true, open: true, closed: false, tone: "red" } }),
  });`;

  test("for the time of the arrival, beside the custom properties", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: {
        body: `<a id="card" href="/t/b" data-turn="card">b</a>`,
        script: CARD,
      },
      b: {
        head: WATCH,
        css: `[data-turn-arriving="card"] main { animation: rise 600ms both } ${RISE}`,
      },
    });
    await page.goto("/t/a");
    await page.click("#card");
    await page.waitForURL("**/t/b");
    expect(await marks(page)).toEqual({
      arriving: "card",
      entering: true,
      with: "hadHeader open",
      tone: "red",
    });
    expect(
      await page.evaluate(
        () => document.querySelectorAll('[data-turn-with~="hadHeader"]').length,
      ),
    ).toBe(1);
    await expect
      .poll(() => noted(page, "/t/b", "arrived"))
      .toMatchObject({ whole: true });
    expect(await marks(page)).toEqual({
      arriving: null,
      entering: false,
      with: null,
      tone: null,
    });
  });

  test("on a return from the back/forward cache too", async ({
    page,
    context,
  }) => {
    await serve(context, {
      list: {
        head: WATCH,
        body: `<a id="open" href="/t/project" data-turn="project">open</a>`,
        script: `pageturn.configure({ stuckTimeout: 60000 });
          pageturn.defineMove("project", {
            leave: () => ({ returnAs: "project-back", remember: { open: true, tone: "red" } }),
          });`,
      },
      project: { stays: true },
    });
    await page.goto("/t/list");
    await page.evaluate(() => document.getElementById("open")?.click());
    await page.waitForTimeout(600);
    expect(
      await page.evaluate(() => {
        sessionStorage.setItem(
          "pageturn:left",
          JSON.stringify({ from: "/t/project", at: Date.now(), data: null }),
        );
        dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
        const { dataset, style } = document.documentElement;
        return {
          arriving: dataset.turnArriving,
          with: dataset.turnWith,
          tone: style.getPropertyValue("--turn-tone"),
        };
      }),
    ).toEqual({ arriving: "project-back", with: "open", tone: "red" });
    await expect
      .poll(() => noted(page, "/t/list", "arrived"))
      .toEqual({ move: "project-back", entering: false, whole: true });
  });

  test("by Back, what the page left reported too, beside what the entry kept", async ({
    page,
    context,
  }) => {
    // Read in the head, before the arrival can end.
    const CARRIED = `<script>
      note("carried", {
        with: document.documentElement.dataset.turnWith ?? null,
        tone: document.documentElement.style.getPropertyValue("--turn-tone") || null,
        shade: document.documentElement.style.getPropertyValue("--turn-shade") || null,
      });
    </script>`;
    await serve(context, {
      list: {
        head: CARRIED,
        body: `<a id="open" href="/t/project" data-turn="project">open</a>`,
        script: `pageturn.defineMove("project", {
          leave: () => ({ returnAs: "project-back", remember: { tone: "red" } }),
        });`,
      },
      project: {
        script: `pageturn.whenLeft(() => ({ shade: "blue", wide: true }));`,
      },
    });
    await page.goto("/t/list");
    await page.click("#open");
    await page.waitForURL("**/t/project");
    await page.goBack();
    await page.waitForURL("**/t/list");
    expect(await noted(page, "/t/list", "carried")).toEqual({
      with: "wide",
      tone: "red",
      shade: "blue",
    });
  });
});

test.describe("ending an arrival", () => {
  test("endArrival removes the mark, only under its name, and arrival() still answers", async ({
    page,
    context,
  }) => {
    await serve(context, { a: {}, b: {} });
    await page.goto("/t/a");
    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    const state = () =>
      page.evaluate(() => ({
        arriving: document.documentElement.dataset.turnArriving ?? null,
        move: window.pageturn?.arrival?.move,
      }));
    await page.evaluate(() => window.pageturn?.endArrival("other"));
    expect(await state()).toEqual({ arriving: "page", move: "page" });
    await page.evaluate(() => window.pageturn?.endArrival("page"));
    expect(await state()).toEqual({ arriving: null, move: "page" });
  });

  test("the ESM endArrival, from pageturn/core", async ({ page, context }) => {
    await serve(context, {
      a: { kernel: "core" },
      b: { kernel: "core" },
    });
    await page.goto("/t/a");
    await page.waitForFunction(() => document.readyState === "complete");
    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    expect(await noted(page, "/t/b", "arriving")).toBe("page");
    await page.evaluate(async (url) => {
      const { endArrival } = await import(url);
      endArrival();
    }, "/dist/core.js");
    expect(
      await page.evaluate(() => document.documentElement.dataset.turnArriving),
    ).toBeUndefined();
  });

  test("entering the back/forward cache ends the arrival", async ({
    page,
    context,
  }) => {
    await serve(context, { a: {}, b: {} });
    await page.goto("/t/a");
    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    // Playwright's browsers do not use the cache: its pagehide is dispatched.
    expect(
      await page.evaluate(() => {
        dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
        return {
          arriving: document.documentElement.dataset.turnArriving ?? null,
          arrival: window.pageturn?.arrival ?? null,
        };
      }),
    ).toEqual({ arriving: null, arrival: null });
  });
});

test.describe("what an arrival leaves alone, and what it says as it ends", () => {
  test("endArrival removes only what the arrival set, and gives back what it covered", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: {
        body: `<a id="card" href="/t/b" data-turn="card">b</a>`,
        script: `pageturn.defineMove("card", {
          leave: () => ({ data: { tone: "red", shift: "9px" } }),
        });`,
      },
      b: {
        head: `${WATCH}<script>
          document.documentElement.style.setProperty("--turn-shift", "3px");
          document.documentElement.style.setProperty("--turn-leave-max", "150ms");
        </script>`,
        script: `pageturn.configure({ arrivalEnds: "manually" });`,
      },
    });
    await page.goto("/t/a");
    await page.click("#card");
    await page.waitForURL("**/t/b");
    await page.evaluate(() => window.pageturn?.endArrival());
    expect(
      await page.evaluate(() => {
        const { style } = document.documentElement;
        return [
          style.getPropertyValue("--turn-shift"),
          style.getPropertyValue("--turn-leave-max"),
          style.getPropertyValue("--turn-tone"),
        ];
      }),
    ).toEqual(["3px", "150ms", ""]);
  });

  test("pageturn:arrived names the move even when its mark came after the kernel started", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: {
        head: WATCH,
        script: `pageturn.configure({ arrivalEnds: "manually" });`,
      },
    });
    await page.goto("/t/a");
    // Followed from the start as a page shown anew with no move; the mark comes later, as
    // pagereveal sets it when the browser turns out not to play the default move.
    await page.evaluate(() => {
      document.documentElement.dataset.turnArriving = "page";
    });
    await page.evaluate(() => window.pageturn?.endArrival());
    await expect
      .poll(() => noted(page, "/t/a", "arrived"))
      .toMatchObject({ move: "page" });
  });
});
