/** pageturn/morph: the core: a picture from a page to the next, before or after the page changes. */
import { expect, test } from "@playwright/test";
import { seekTravel } from "../../src/testing/testing.ts";
import { noted, notes, type PageSpec, serve } from "../support/site.ts";
import {
  boxOf,
  CARD,
  CARD_BOX,
  firstFrame,
  forget,
  HEAD_HALF,
  HERO,
  HERO_BOX,
  HERO_END,
  morph,
  ready,
  shop,
  svg,
  swapped,
} from "./support.ts";

test.describe("the core", () => {
  test("with the other end found, it travels on the page left and is in place on the first frame of the next", async ({
    page,
    context,
  }) => {
    await serve(context, shop({ options: `find: () => (${HERO_END}),` }));
    await page.goto("/t/list");
    await ready(page);
    expect(await boxOf(page, "#thumb")).toEqual(CARD_BOX);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    expect(await noted(page, "/t/list", "leaving")).toBe("product");
    expect(await noted(page, "/t/list", "during")).toEqual({
      back: false,
      hasLink: true,
      start: CARD_BOX,
      stop: HERO_BOX,
      radius: [6, 20],
    });
    expect(await noted(page, "/t/list", "stopped")).toEqual(HERO_BOX);
    expect(await noted(page, "/t/product", "arriving")).toBe("product");
    // The layer crossed the page change: put back by the head script, before the body.
    expect(await noted(page, "/t/product", "placed in the head")).toBe(true);
    // On the first frame it stands for the element, or is already swapped for it: the
    // element is in place either way.
    expect([
      { layer: HERO_BOX, open: true, hidden: "hidden" },
      { layer: null, open: null, hidden: "visible" },
    ]).toContainEqual(await firstFrame(page, "/t/product"));
    await swapped(page, "#hero");
    // In place already: the page reached played nothing.
    expect(await noted(page, "/t/product", "during")).toBeUndefined();
  });

  test("here() finds the other end on a page of the same template", async ({
    page,
    context,
  }) => {
    await serve(
      context,
      shop({
        options: `find: here(),`,
        list: {
          kernel: "core",
          sheet: "none",
          body: `${HERO}<div style="height: 1500px"></div><div style="position: relative; height: 200px">${CARD}</div>`,
        },
      }),
    );
    await page.goto("/t/list");
    await ready(page);
    await page.locator("#thumb").scrollIntoViewIfNeeded();
    await page.click("#card");
    await page.waitForURL("**/t/product");
    // Where the page shows it at its top, not where it is now, scrolled away.
    expect(await noted(page, "/t/list", "stopped")).toEqual(HERO_BOX);
    await swapped(page, "#hero");
  });

  test("with no end found, the layer holds still and the page reached plays the travel", async ({
    page,
    context,
    browserName,
  }) => {
    await serve(context, shop());
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    expect(await noted(page, "/t/list", "during")).toBeUndefined();
    const first = (await firstFrame(page, "/t/product")) as { layer: number[] };
    expect(first).toMatchObject({ open: true, hidden: "hidden" });
    // Where the page left it. Playwright's WebKit runs a page's first frame callback late,
    // the travel well under way: there, Safari is looked at by hand (release checklist).
    if (browserName !== "webkit") expect(first.layer).toEqual(CARD_BOX);
    await swapped(page, "#hero");
    expect(await noted(page, "/t/product", "during")).toEqual({
      back: false,
      hasLink: false,
      start: CARD_BOX,
      stop: HERO_BOX,
      radius: [6, 20],
    });
    expect(await noted(page, "/t/product", "stopped")).toEqual(HERO_BOX);
  });

  test("the layer keeps its styles under a Content-Security-Policy without inline styles", async ({
    page,
    context,
  }) => {
    const both = shop();
    await serve(context, {
      list: both.list as PageSpec,
      product: {
        ...(both.product as PageSpec),
        headers: {
          "Content-Security-Policy": "style-src 'self'; img-src data:",
        },
      },
    });
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    expect(await firstFrame(page, "/t/product")).toMatchObject({
      layer: CARD_BOX,
      open: true,
    });
  });

  test("seen() answers once a page has shown the element", async ({
    page,
    context,
  }) => {
    await serve(context, shop({ options: `find: seen(),` }));
    await page.goto("/t/product");
    await ready(page);
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    expect(await noted(page, "/t/list", "stopped")).toEqual(HERO_BOX);
  });

  test("an estimate that is right is not corrected, however its end is written", async ({
    page,
    context,
  }) => {
    // The page reached reads `rotate: 0` with turned(); the finder's end has none.
    await serve(
      context,
      shop({ options: `find: () => (${HERO_END}), use: [turned()],` }),
    );
    await page.addInitScript(() => {
      if (location.pathname !== "/t/product") return;
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...given) {
        if (this.matches("[data-turn-layer]")) {
          sessionStorage.setItem("corrected", "yes");
        }
        return animate.apply(this, given);
      };
    });
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    await swapped(page, "#hero");
    expect(
      await page.evaluate(() => sessionStorage.getItem("corrected")),
    ).toBeNull();
  });

  test("a wrong estimate is corrected on the page reached", async ({
    page,
    context,
  }) => {
    await serve(
      context,
      shop({
        options: `find: () => ({ box: { left: 250, top: 60, width: 400, height: 200 }, radius: 20 }),`,
      }),
    );
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    expect(await firstFrame(page, "/t/product")).toMatchObject({
      layer: [250, 60, 400, 200],
      hidden: "hidden",
    });
    await swapped(page, "#hero");
    expect(await boxOf(page, "#hero")).toEqual(HERO_BOX);
    // A correction is the package's: the site's keyframes are not played again.
    expect(await noted(page, "/t/product", "during")).toBeUndefined();
  });

  test("the page reached is measured with its arrival's animations over", async ({
    page,
    context,
  }) => {
    await serve(
      context,
      shop({
        product: {
          kernel: "core",
          sheet: "none",
          css: `@keyframes rise { from { translate: 0 300px } } html[data-turn-arriving] main { animation: rise 2s both }`,
          body: HERO,
        },
      }),
    );
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    await expect.poll(() => noted(page, "/t/product", "during")).toBeDefined();
    const { stop } = (await noted(page, "/t/product", "during")) as {
      stop: number[];
    };
    // Where it comes to rest, not 300 pixels lower, where the arrival starts it. (Held
    // by an animation, <main> is what its picture is placed in: below the links.)
    expect(stop[1]).toBeLessThan(200);
  });

  test("a picture is not stretched between two proportions: it is cropped", async ({
    page,
    context,
  }) => {
    const square = `<a id="card" href="/t/product" style="position: absolute; left: 20px; top: 40px; display: block; width: 100px"><img id="thumb" alt="" src="${svg(160, 90)}" style="display: block; width: 100px; height: 100px; object-fit: cover; object-position: 20% 50%"></a>`;
    await serve(
      context,
      shop({
        options: `find: () => ({ box: { left: 300, top: 100, width: 400, height: 200 }, radius: 0 }),
          during({ layer, content }) {
            const { scale, clipPath, width } = getComputedStyle(layer);
            const { objectFit, objectPosition } = getComputedStyle(content);
            note("picture", { scale, clipPath, width, tag: content.localName, objectFit, objectPosition });
          },`,
        list: { kernel: "core", sheet: "none", body: square },
      }),
    );
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    // Laid out at the size it grows to, covering the square it starts from, cropped to it.
    expect(await noted(page, "/t/list", "picture")).toEqual({
      scale: "0.5",
      clipPath: expect.stringMatching(/^inset\(0px 100px/),
      width: "400px",
      tag: "img",
      objectFit: "cover",
      objectPosition: "20% 50%",
    });
  });

  test("a <picture> travels whole, asks for the file its place needs, and crosses with the file it drew", async ({
    page,
    context,
  }) => {
    const small = svg(120, 60);
    const large = svg(480, 240, "navy");
    const pictured = `<a id="card" href="/t/product" style="position: absolute; left: 20px; top: 40px; display: block; width: 120px"><picture id="thumb"><source srcset="${small} 120w, ${large} 480w" sizes="120px"><img alt="" src="${small}" srcset="${small} 120w, ${large} 480w" sizes="120px" style="display: block; width: 120px; height: 60px"></picture></a>`;
    await serve(
      context,
      shop({
        options: `find: () => (${HERO_END}),
          during({ layer, content, finished }) {
            note("asked", {
              tag: content.localName,
              sizes: [...layer.querySelectorAll("source, img")].map((sized) => sized.sizes),
            });
          },`,
        list: { kernel: "core", sheet: "none", body: pictured },
      }),
    );
    await page.goto("/t/list");
    await ready(page);
    await page.addInitScript(() => {
      // What the layer put back on the page reached is made of.
      const seen = new MutationObserver(() => {
        const layer = document.querySelector("html > [data-turn-layer]");
        if (!layer || sessionStorage.getItem("layer")) return;
        sessionStorage.setItem(
          "layer",
          JSON.stringify({
            sources: layer.querySelectorAll("source").length,
            srcset: layer.querySelector("img")?.getAttribute("srcset") ?? null,
            hasFile: Boolean(layer.querySelector("img")?.getAttribute("src")),
          }),
        );
      });
      seen.observe(document, { childList: true, subtree: true });
    });
    await page.click("#card");
    await page.waitForURL("**/t/product");
    expect(await noted(page, "/t/list", "asked")).toEqual({
      tag: "picture",
      sizes: ["400px", "400px"],
    });
    expect(
      await page.evaluate(() =>
        JSON.parse(sessionStorage.getItem("layer") ?? "null"),
      ),
    ).toEqual({ sources: 0, srcset: null, hasFile: true });
  });

  test.describe("at one device pixel per CSS pixel", () => {
    // At two (Playwright's Safari), the thumbnail draws the large file already, and the
    // copy finds it in memory: there is no held file to show the layer does not wait for.
    test.use({ deviceScaleFactor: 1 });

    test("with its files held, the layer still shows what the page had drawn, and does not wait", async ({
      page,
      context,
    }) => {
      // Routing switches the browser's cache off: the layer's copy asks for its file again.
      let isHeld = false;
      const requested: string[] = [];
      await context.route("**/held/*.svg", async (route) => {
        requested.push(new URL(route.request().url()).pathname);
        if (isHeld) await new Promise((resolve) => setTimeout(resolve, 700));
        const fill = route.request().url().includes("large") ? "navy" : "teal";
        await route.fulfill({
          contentType: "image/svg+xml",
          body: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="${fill}"/></svg>`,
        });
      });
      const files = `src="/held/small.svg" srcset="/held/small.svg 120w, /held/large.svg 480w"`;
      const card = `<a id="card" href="/t/product" style="position: absolute; left: 20px; top: 40px; display: block; width: 120px"><img id="thumb" alt="" ${files} sizes="120px" loading="lazy" decoding="async" style="display: block; width: 120px; height: 60px"></a>`;
      await serve(
        context,
        shop({
          // Long enough for the held file to come before the page changes.
          options: `find: () => (${HERO_END}), duration: 1500,
            during({ layer, content }) {
              const shot = layer.querySelector("canvas");
              note("at the start", {
                after: Math.round(performance.now() - window.clickedAt),
                copyHasDrawn: content.complete && content.naturalWidth > 0,
                // The middle of what the page had drawn, on the layer.
                shot: shot && [...shot.getContext("2d").getImageData(shot.width / 2, shot.height / 2, 1, 1).data],
                thumbnail: getComputedStyle(document.getElementById("thumb")).visibility,
              });
              content.addEventListener("load", () => setTimeout(() =>
                note("once drawn", { shots: layer.querySelectorAll("canvas").length, file: content.currentSrc.split("/").pop() }), 100));
            },`,
          list: {
            kernel: "core",
            sheet: "none",
            body: card,
            script: `addEventListener("click", () => { window.clickedAt = performance.now(); }, true);`,
          },
          product: { stays: true },
        }),
      );
      await page.goto("/t/list");
      await ready(page);
      await page.waitForFunction(
        () => (document.getElementById("thumb") as HTMLImageElement).complete,
      );
      isHeld = true;
      await page.evaluate(() => document.getElementById("card")?.click());
      await expect
        .poll(() => noted(page, "/t/list", "at the start"))
        .toBeDefined();
      const start = (await noted(page, "/t/list", "at the start")) as {
        after: number;
      };
      // Nothing of the copy has come, the thumbnail is hidden, and its picture is there.
      expect(start).toMatchObject({
        copyHasDrawn: false,
        shot: [0, 128, 128, 255],
        thumbnail: "hidden",
      });
      // The travel does not wait for a file: it starts at the click.
      expect(start.after).toBeLessThan(150);
      // Then the file its place needs comes, and what stood in for it goes.
      await expect
        .poll(() => noted(page, "/t/list", "once drawn"))
        .toEqual({ shots: 0, file: "large.svg" });
      expect(requested).toContain("/held/large.svg");
    });
  });

  test("arriveAs names the arrival: two morphs can land on a page and share it", async ({
    page,
    context,
  }) => {
    const related = `<script type="module">
      import { defineMorph } from "/dist/morph.js";
      defineMorph("related", {
        from: (link) => (link.id === "related" ? link.querySelector("img") : null),
        to: "#hero",
        arriveAs: "product",
        duration: 100,
        during: () => note("related played", true),
      });
    </script>`;
    const both = shop();
    await serve(context, {
      list: {
        ...(both.list as PageSpec),
        head: `${(both.list as PageSpec).head}${related}`,
        body: `${CARD}<a id="related" href="/t/product" style="position: absolute; left: 20px; top: 300px"><img alt="" src="${svg(120, 60)}" style="display: block; width: 120px; height: 60px"></a>`,
      },
      product: {
        ...(both.product as PageSpec),
        head: `${(both.product as PageSpec).head}${related}`,
      },
    });
    await page.goto("/t/list");
    await ready(page);
    await page.click("#related");
    await page.waitForURL("**/t/product");
    expect(await noted(page, "/t/list", "leaving")).toBe("related");
    expect(await noted(page, "/t/product", "arriving")).toBe("product");
    expect(await firstFrame(page, "/t/product")).toMatchObject({
      layer: [20, 300, 120, 60],
      hidden: "hidden",
    });
    await swapped(page, "#hero");
    // Its own travel played, not the other morph's of the same arrival.
    expect(await noted(page, "/t/product", "related played")).toBe(true);
    expect(await noted(page, "/t/product", "during")).toBeUndefined();
  });

  test("data hands the page reached its own data, as a move does", async ({
    page,
    context,
  }) => {
    await serve(
      context,
      shop({ options: `data: (turn) => ({ to: turn.to.pathname }),` }),
    );
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    expect(await noted(page, "/t/product", "arrival")).toEqual({
      move: "product",
      via: "link",
      from: "/t/list",
      data: { to: "/t/product" },
      remembered: null,
      reported: null,
    });
    await swapped(page, "#hero");
  });

  test("ends may move an end, and declines with decline() only", async ({
    page,
    context,
  }) => {
    await serve(context, {
      ...shop({
        options: `ends({ from }, { back, link }) {
          note("asked", { back, hasLink: Boolean(link) });
          if (link) from.box = { left: 500, top: 300, width: 60, height: 30 };
        },`,
      }),
      plain: {
        kernel: "core",
        sheet: "none",
        body: `<a id="card" href="/t/product">card<img id="thumb" alt="" src="${svg(120, 60)}"></a>`,
        head: morph(
          `ends: ({ to }, { decline }) => (to ? undefined : decline()),`,
        ),
      },
      old: {
        kernel: "core",
        sheet: "none",
        body: `<a id="card" href="/t/product">card<img id="thumb" alt="" src="${svg(120, 60)}"></a>`,
        head: morph(`ends: ({ to }) => to !== null,`),
      },
    });
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    expect(await noted(page, "/t/list", "asked")).toEqual({
      back: false,
      hasLink: true,
    });
    expect(await firstFrame(page, "/t/product")).toMatchObject({
      layer: [500, 300, 60, 30],
    });
    await swapped(page, "#hero");

    // No finder answered and the site wants none of it: the default move plays.
    await page.goto("/t/plain");
    await ready(page);
    await forget(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    expect(await noted(page, "/t/product", "arriving")).toBe("page");
    expect(await firstFrame(page, "/t/product")).toMatchObject({ layer: null });

    // false, the answer before decline(), declines nothing: the morph plays.
    await page.goto("/t/old");
    await ready(page);
    await forget(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    expect(await noted(page, "/t/product", "arriving")).toBe("product");
  });

  test("it plays without the head script's morph half, from when the module has loaded", async ({
    page,
    context,
  }) => {
    await serve(context, shop({ noHead: true }));
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    await swapped(page, "#hero");
    expect(await noted(page, "/t/product", "placed in the head")).toBe(false);
    expect(await noted(page, "/t/product", "stopped")).toEqual(HERO_BOX);
  });

  test("a page with the morph half and no morph shows as it is", async ({
    page,
    context,
  }) => {
    const both = shop();
    await serve(context, {
      list: both.list as PageSpec,
      product: {
        kernel: "core",
        sheet: "none",
        body: HERO,
        head: HEAD_HALF,
      },
    });
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    await swapped(page, "#hero");
  });

  test("a stuck navigation puts the element back", async ({
    page,
    context,
  }) => {
    const both = shop();
    await serve(context, {
      list: {
        ...(both.list as PageSpec),
        script: `addEventListener("load", () => import("/dist/core.js").then((core) => core.configure({ stuckTimeout: 300 })));`,
      },
      product: { stays: true },
    });
    await page.goto("/t/list");
    await ready(page);
    await page.waitForTimeout(100);
    await page.evaluate(() => document.getElementById("card")?.click());
    await expect
      .poll(() =>
        page.evaluate(
          () => document.querySelectorAll("html > [data-turn-layer]").length,
        ),
      )
      .toBe(1);
    await swapped(page, "#thumb");
  });

  test("restore is told when the page stays, after the element is back", async ({
    page,
    context,
  }) => {
    const both = shop({
      options: `stay: (turn, stay) => note("restore", {
        move: turn.move,
        reason: stay.reason,
        layers: document.querySelectorAll("html > [data-turn-layer]").length,
        thumbnail: getComputedStyle(document.getElementById("thumb")).visibility,
      }),`,
    });
    await serve(context, {
      list: {
        ...(both.list as PageSpec),
        script: `addEventListener("load", () => import("/dist/core.js").then((core) => core.configure({ stuckTimeout: 300 })));`,
      },
      product: { stays: true },
    });
    await page.goto("/t/list");
    await ready(page);
    await page.waitForTimeout(100);
    await page.evaluate(() => document.getElementById("card")?.click());
    await expect
      .poll(() => noted(page, "/t/list", "restore"))
      .toEqual({
        move: "product",
        reason: "stuck",
        layers: 0,
        thumbnail: "visible",
      });
  });

  test("atEnd reads the layer as it will be when the travel ends", async ({
    page,
    context,
  }) => {
    await serve(
      context,
      shop({
        options: `find: () => (${HERO_END}),
          during({ layer, atEnd }) {
            const width = () => Math.round(layer.getBoundingClientRect().width);
            note("widths", [width(), atEnd(width), width()]);
          },`,
        product: { stays: true },
      }),
    );
    await page.goto("/t/list");
    await ready(page);
    await page.evaluate(() => document.getElementById("card")?.click());
    await expect
      .poll(() => noted(page, "/t/list", "widths"))
      .toEqual([120, 400, 120]);
  });

  test("reduced motion plays nothing", async ({ page, context }) => {
    await serve(context, shop({ options: `find: here(),` }));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    expect(
      (await notes(page)).filter((note) => note.key === "leaving"),
    ).toEqual([]);
    expect(await firstFrame(page, "/t/product")).toEqual({
      layer: null,
      open: null,
      hidden: "visible",
    });
  });
});

test("a layer handed over that cannot be read hides nothing and throws nothing", async ({
  page,
  context,
}) => {
  await serve(context, {
    a: { kernel: "core", sheet: "none" },
    b: {
      kernel: "core",
      sheet: "none",
      head: `<script>addEventListener("error", (event) => note("error", event.message));</script>${HEAD_HALF}`,
      body: `<img id="hero" alt="" src="${svg(120, 60)}">`,
    },
  });
  await page.goto("/t/a");
  // A mark for "product", and a flight whose markup is empty: truncated, or from an
  // older version of the package.
  await page.evaluate(() => {
    sessionStorage.setItem(
      "pageturn",
      JSON.stringify({
        move: "product",
        data: null,
        from: "/t/a",
        to: "/t/b",
        at: Date.now(),
      }),
    );
    sessionStorage.setItem(
      "pageturn:morph",
      JSON.stringify({
        n: "product",
        m: "product",
        h: "",
        e: { box: { left: 0, top: 0, width: 1, height: 1 }, radius: 0 },
        t: false,
        s: "#hero",
      }),
    );
    location.assign("/t/b");
  });
  await page.waitForURL("**/t/b");
  await page.waitForLoadState("load");
  expect(await noted(page, "/t/b", "error")).toBeUndefined();
  expect(
    await page.evaluate(
      () =>
        getComputedStyle(document.getElementById("hero") as Element).visibility,
    ),
  ).toBe("visible");
});

test.describe("corners, as they are seen", () => {
  /** A card that rounds the top of its picture by clipping it: the picture has no radius. */
  const clippedCard = (picture = "") =>
    `<a id="card" href="/t/product" style="position: absolute; left: 20px; top: 40px; display: block; width: 120px; border: 1px solid #ccc; border-radius: 18px; overflow: hidden"><img id="thumb" alt="" src="${svg(120, 60)}" style="display: block; width: 120px; height: 60px; ${picture}"><span style="display: block; height: 20px">Lamp</span></a>`;

  const corners = `during(play) {
    note("corners", { back: play.back, start: play.start.radius, stop: play.stop.radius });
  },
  use: [back()],`;

  test("a parent that clips the picture rounds the corners it shares with it, there and back", async ({
    page,
    context,
  }) => {
    await serve(
      context,
      shop({ options: corners, list: { body: clippedCard() } }),
    );
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    // Inside the card's 1px border, its 18px corners are 17px; the bottom is not the card's.
    await expect
      .poll(() => noted(page, "/t/product", "corners"))
      .toEqual({ back: false, start: [17, 17, 0, 0], stop: 20 });
    await swapped(page, "#hero");

    await page.goBack();
    await page.waitForURL("**/t/list");
    await expect
      .poll(() => noted(page, "/t/list", "corners"))
      .toEqual({ back: true, start: 20, stop: [17, 17, 0, 0] });
  });

  test("the layer is clipped corner by corner, held at its start", async ({
    page,
    context,
  }) => {
    await serve(
      context,
      shop({
        options: `find: () => (${HERO_END}), duration: 5000,`,
        list: { body: clippedCard() },
        product: { stays: true },
      }),
    );
    await page.goto("/t/list");
    await ready(page);
    await page.evaluate(() => document.getElementById("card")?.click());
    expect(await seekTravel(page, 0)).toBe(true);
    // The layer is the hero's size scaled down to the card's picture: its corners too.
    const clip = await page.evaluate(
      () =>
        getComputedStyle(
          document.querySelector("html > [data-turn-layer]") as Element,
        ).clipPath,
    );
    const radii = /round (.*)\)$/
      .exec(clip)?.[1]
      ?.split(" ")
      .map(Number.parseFloat);
    // 17px at a scale of 120 / 400, on the top corners only.
    expect(radii?.map(Math.round)).toEqual([57, 57, 0, 0]);
  });

  test("an element's own corners are kept one by one", async ({
    page,
    context,
  }) => {
    await serve(
      context,
      shop({
        options: corners,
        list: {
          body: CARD.replace(
            "border-radius: 6px",
            "border-radius: 12px 0 12px 0",
          ),
        },
      }),
    );
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    await expect
      .poll(() => noted(page, "/t/product", "corners"))
      .toEqual({ back: false, start: [12, 0, 12, 0], stop: 20 });
  });
});
