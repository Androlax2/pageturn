/** pageturn/morph: `keep` and the focus given back, `animate` and the layer's parts in `during`, `behind({ appear })`, and what does nothing in a frame or under reduced motion. */
import { expect, test } from "@playwright/test";
import { noted, notes, type PageSpec, serve } from "../support/site.ts";
import {
  CARD,
  forget,
  HEAD_HALF,
  HERO,
  HERO_END,
  headline,
  morph,
  news,
  open,
  ready,
  shop,
  swapped,
} from "./support.ts";

test.describe("keep, the focus, animate, the parts, appear, and the guards", () => {
  const MENU = `<button id="opens" popovertarget="menu">menu</button>
    <div id="menu" popover="manual" style="inset: 80px auto auto 20px; width: 300px; height: 200px">
      <a id="first" href="#">first</a>${CARD}
    </div>
    <div id="cap"></div><div id="panel" data-open></div>`;
  // The page's own menu takes the focus as it opens, as a menu does.
  const MENU_SCRIPT = `document.getElementById("menu").addEventListener("toggle", (event) => {
    if (event.newState === "open") document.getElementById("first").focus();
  });`;

  test("keep: the attributes are put back, and the focus goes back to the link, from inside the popover shown again", async ({
    page,
    context,
  }) => {
    const options = `use: [linkBack({ keep: { html: "data-menu-from", "#cap": "data-shown", "#panel": ["data-open"] } })],`;
    const seesAtOnce = `<script>
      document.addEventListener("readystatechange", () => {
        const at = (selector, name) => document.querySelector(selector).getAttribute(name);
        note("at once", [at("html", "data-menu-from"), at("#cap", "data-shown"), at("#panel", "data-open"), "turnEntering" in document.documentElement.dataset]);
      }, { once: true });
    </script>`;
    const both = shop({ options });
    await serve(context, {
      list: {
        ...(both.list as PageSpec),
        head: `${HEAD_HALF}${seesAtOnce}${morph(options)}`,
        body: MENU,
        script: MENU_SCRIPT,
      },
      product: both.product as PageSpec,
    });
    await page.goto("/t/list");
    await ready(page);
    await page.click("#opens");
    await page.evaluate(() => {
      document.documentElement.dataset.menuFrom = "capsule";
      document.getElementById("cap")?.setAttribute("data-shown", "");
      document.getElementById("panel")?.removeAttribute("data-open");
    });
    await page.click("#card");
    await page.waitForURL("**/t/product");
    await ready(page);
    await swapped(page, "#hero");
    await forget(page);
    await page.click("#back");
    await page.waitForURL("**/t/list");
    await ready(page);
    expect(await noted(page, "/t/list", "at once")).toEqual([
      "capsule",
      "",
      null,
      // Put back, not shown anew.
      false,
    ]);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          focused: document.activeElement?.id,
          ring: document.activeElement?.matches(":focus-visible"),
          restoring: "turnRestoring" in document.documentElement.dataset,
        })),
      )
      .toEqual({ focused: "card", ring: false, restoring: false });
  });

  test("the focus shows when the way out was taken from the keyboard, and is left where the visitor put it", async ({
    page,
    context,
  }) => {
    const options = `use: [linkBack()],`;
    const both = shop({ options });
    await serve(context, {
      list: both.list as PageSpec,
      product: both.product as PageSpec,
      // The page's own script puts the focus somewhere: it is not taken from there.
      elsewhere: {
        ...(both.list as PageSpec),
        body: `${CARD}<input id="search">`,
        script: `addEventListener("DOMContentLoaded", () => document.getElementById("search").focus());`,
      },
    });
    await page.goto("/t/list");
    await ready(page);
    // From the keyboard: tabbed to, past the page's other links.
    for (let tab = 0; tab < 10; tab += 1) {
      await page.keyboard.press("Tab");
      if (await page.evaluate(() => document.activeElement?.id === "card")) {
        break;
      }
    }
    await expect(page.locator("#card")).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/t/product");
    await ready(page);
    await swapped(page, "#hero");
    await page.click("#back");
    await page.waitForURL("**/t/list");
    await ready(page);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          focused: document.activeElement?.id,
          ring: document.activeElement?.matches(":focus-visible"),
        })),
      )
      .toEqual({ focused: "card", ring: true });

    await page.goto("/t/elsewhere");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    await ready(page);
    await swapped(page, "#hero");
    await page.evaluate(() => {
      const back = document.getElementById("back") as HTMLAnchorElement;
      back.href = "/t/elsewhere";
      back.click();
    });
    await page.waitForURL("**/t/elsewhere");
    await ready(page);
    await swapped(page, "#thumb");
    expect(await page.evaluate(() => document.activeElement?.id)).toBe(
      "search",
    );
  });

  test("animate in during: waited for, and cancelled when the page stays", async ({
    page,
    context,
  }) => {
    await serve(
      context,
      shop({
        options: `find: () => (${HERO_END}),
          during({ animate, finished }) {
            const started = performance.now();
            const main = document.querySelector("main");
            const fade = animate(main, { opacity: [1, 0] }, { duration: 600 });
            note("timing", { duration: fade.effect.getTiming().duration, fill: fade.effect.getTiming().fill });
            finished.then(() => note("finished after", performance.now() - started));
          },
          stay: () => note("main after", {
            animations: document.querySelector("main").getAnimations().length,
            opacity: getComputedStyle(document.querySelector("main")).opacity,
          }),`,
        list: {
          script: `addEventListener("load", () => import("/dist/core.js").then((core) => core.configure({ stuckTimeout: 300 })));`,
        },
        product: { stays: true },
      }),
    );
    await page.goto("/t/list");
    await ready(page);
    await page.waitForTimeout(100);
    await page.evaluate(() => document.getElementById("card")?.click());
    await expect
      .poll(() => noted(page, "/t/list", "main after"))
      .toEqual({ animations: 0, opacity: "1" });
    expect(await noted(page, "/t/list", "timing")).toEqual({
      duration: 600,
      fill: "both",
    });
    expect(
      (await noted(page, "/t/list", "finished after")) as number,
    ).toBeGreaterThan(550);
  });

  test("animate in during, on the page reached: cancelled once the layer is swapped", async ({
    page,
    context,
  }) => {
    await serve(
      context,
      shop({
        options: `during({ animate }) {
            animate(document.querySelector("main"), { opacity: [0.5, 1] }, { duration: 300 });
          },`,
      }),
    );
    await open(page);
    expect(
      await page.evaluate(
        () => document.querySelector("main")?.getAnimations().length,
      ),
    ).toBe(0);
  });

  test("box and words in Play, for text(); null for a picture", async ({
    page,
    context,
  }) => {
    await serve(
      context,
      news(`find: peek(),
        during: (play) => note("parts", [play.box?.hasAttribute("data-turn-box"), play.words?.textContent]),`),
    );
    await page.goto("/t/news");
    await ready(page);
    await page.click("#headline");
    await page.waitForURL("**/t/article");
    expect(await noted(page, "/t/news", "parts")).toEqual([
      true,
      "A chair for life",
    ]);

    await serve(
      context,
      shop({
        options: `during: (play) => note("parts", [play.box, play.words]),`,
      }),
    );
    await open(page);
    expect(await noted(page, "/t/product", "parts")).toEqual([null, null]);
  });

  test("behind({ appear }): the page behind comes in on its own timing, the attributes kept in the copy too", async ({
    page,
    context,
  }) => {
    const options = `find: peek(),
      use: [linkBack({ keep: { html: "data-tone" } }), behind({ appear: { duration: 400, delay: 50, easing: "linear" } })],
      during: (play) => queueMicrotask(() => {
        const fade = play.behind?.getAnimations()[0]?.effect?.getTiming();
        note("appear", fade ? [fade.duration, fade.delay, fade.easing] : null);
      }),`;
    const both = news(options);
    await serve(context, {
      news: {
        ...(both.news as PageSpec),
        // Set as the link is clicked, in the real page only: the copy has it from the package.
        head: `${HEAD_HALF}<script>if (window.top !== window) document.addEventListener("readystatechange", () => note("copy's tone", document.documentElement.dataset.tone ?? null), { once: true });</script>${headline(options)}`,
        script: `document.getElementById("headline").addEventListener("click", () => { document.documentElement.dataset.tone = "warm"; });`,
      },
      article: both.article as PageSpec,
    });
    await page.goto("/t/news");
    await ready(page);
    await page.click("#headline");
    await page.waitForURL("**/t/article");
    await ready(page);
    await swapped(page, "#title");
    await forget(page);
    await page.click("#back");
    await page.waitForURL("**/t/news");
    expect(await noted(page, "/t/article", "appear")).toEqual([
      400,
      50,
      "linear",
    ]);
    expect(await noted(page, "/t/news", "copy's tone")).toBe("warm");
  });

  test("defineMorph and forgetWayOut do nothing in a frame, nor defineMorph under reduced motion", async ({
    page,
    context,
  }) => {
    // A way out that started on another page, from a link to a third.
    const WAY_OUT = { f: "/t/outer", u: "http://localhost/t/other", k: 0 };
    const inner = `<script type="module">
      import { defineMorph, forgetWayOut, linkBack } from "/dist/morph.js";
      defineMorph("x", { from: () => null, to: "#nothing", use: [linkBack()] });
      forgetWayOut("x");
      note("link back", document.getElementById("close").dataset.turn ?? null);
    </script>`;
    await serve(context, {
      outer: {
        kernel: "core",
        sheet: "none",
        head: `<script>sessionStorage.setItem("pageturn:morph:from:x", JSON.stringify(${JSON.stringify(WAY_OUT)}));</script>`,
        body: `<iframe src="/t/inner"></iframe>`,
      },
      inner: {
        kernel: "core",
        sheet: "none",
        head: inner,
        body: `<a id="close" href="/" data-turn-back="x">close</a>`,
      },
    });
    await page.goto("/t/outer");
    await expect.poll(() => noted(page, "/t/inner", "link back")).toBeNull();
    expect(
      await page.evaluate(() =>
        JSON.parse(sessionStorage.getItem("pageturn:morph:from:x") ?? "null"),
      ),
    ).toEqual(WAY_OUT);

    await page.goto("/t/inner");
    await expect
      .poll(() => noted(page, "/t/inner", "link back"))
      .toBe("x-back");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await expect
      .poll(
        async () =>
          (await notes(page)).filter((note) => note.key === "link back").length,
      )
      .toBe(3);
    expect(await noted(page, "/t/inner", "link back")).toBeNull();
  });
});

test("a page put back after it was parsed (the morph loaded late) ends its restoring, and was not cut short", async ({
  page,
  context,
}) => {
  // The morph's module comes after the page has loaded: the layer is put back then.
  const late = `<script type="module">
    document.addEventListener("pageturn:arrived", (event) => note("arrived", event.detail));
    addEventListener("load", async () => {
      const { defineMorph, linkBack } = await import("/dist/morph.js");
      defineMorph("product", {
        from: (link) => (link.id === "card" ? link.querySelector("#thumb") : null),
        to: "#hero",
        duration: 150,
        use: [linkBack()],
      });
      window.morphReady = true;
    });
  </script>`;
  await serve(context, {
    list: { kernel: "core", sheet: "none", head: late, body: CARD },
    product: {
      kernel: "core",
      sheet: "none",
      head: late,
      body: `${HERO}<a id="back" href="/t/list">back</a>`,
    },
  });
  await page.goto("/t/list");
  await ready(page);
  await page.click("#card");
  await page.waitForURL("**/t/product");
  await ready(page);
  await swapped(page, "#hero");
  await page.click("#back");
  await page.waitForURL("**/t/list");
  await ready(page);
  expect(await noted(page, "/t/product", "leaving")).toBe("product-back");
  await swapped(page, "#thumb");
  await expect
    .poll(() =>
      page.evaluate(() => "turnRestoring" in document.documentElement.dataset),
    )
    .toBe(false);
  // Not cut short. Whether it was still entering depends on whether the late module
  // put it back before its arrival had ended.
  await expect
    .poll(() => noted(page, "/t/list", "arrived"))
    .toMatchObject({ move: "product-back", whole: true });
});
