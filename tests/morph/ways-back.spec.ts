/** pageturn/morph: the ways back: `back()` and `linkBack()`. */
import { expect, test } from "@playwright/test";
import { noted, type PageSpec, serve } from "../support/site.ts";
import {
  boxOf,
  CARD,
  CARD_BOX,
  firstFrame,
  forget,
  gallery,
  HEAD_HALF,
  HERO,
  HERO_BOX,
  morph,
  open,
  ready,
  shop,
  svg,
  swapped,
} from "./support.ts";

test.describe("back() and linkBack()", () => {
  test("back() plays the way back on the browser's Back", async ({
    page,
    context,
  }) => {
    await serve(context, shop({ options: `find: here(), use: [back()],` }));
    await open(page);
    await forget(page);
    await page.goBack();
    await page.waitForURL("**/t/list");
    await ready(page);
    expect(await noted(page, "/t/list", "arriving")).toBe("product-back");
    // From where the page left had it, on the first frame, its own element hidden.
    expect(await firstFrame(page, "/t/list")).toEqual({
      layer: HERO_BOX,
      open: true,
      hidden: "hidden",
    });
    await swapped(page, "#thumb");
    expect(await noted(page, "/t/list", "during")).toEqual({
      back: true,
      hasLink: true,
      start: HERO_BOX,
      stop: CARD_BOX,
      radius: [20, 6],
    });
    expect(await noted(page, "/t/list", "stopped")).toEqual(CARD_BOX);
  });

  test("the way back lands where the page will be scrolled", async ({
    page,
    context,
  }) => {
    await serve(
      context,
      shop({
        options: `use: [back()], ends: (ends, { back, scroll }) => { if (back) note("scroll to come", scroll.y); },`,
        list: {
          kernel: "core",
          sheet: "none",
          body: `<div style="height: 1500px"></div><div style="position: relative; height: 200px">${CARD}</div><div style="height: 1500px"></div>`,
        },
      }),
    );
    await page.goto("/t/list");
    await ready(page);
    await page.evaluate(() => scrollTo(0, 1400));
    const thumb = await boxOf(page, "#thumb");
    await page.click("#card");
    await page.waitForURL("**/t/product");
    await swapped(page, "#hero");
    await forget(page);
    await page.goBack();
    await page.waitForURL("**/t/list");
    await ready(page);
    await swapped(page, "#thumb");
    expect(await noted(page, "/t/list", "stopped")).toEqual(thumb);
    expect(await boxOf(page, "#thumb")).toEqual(thumb);
    // The hook is told the scroll the page will have, whatever it has yet.
    expect(await noted(page, "/t/list", "scroll to come")).toBe(1400);
  });

  test("no way back, and no mark, when the element was out of view as its page was left", async ({
    page,
    context,
  }) => {
    await serve(
      context,
      shop({
        options: `use: [back()],`,
        product: {
          kernel: "core",
          sheet: "none",
          body: `${HERO}<div style="height: 3000px"></div>`,
        },
      }),
    );
    await open(page);
    await page.evaluate(() => scrollTo(0, 2000));
    await forget(page);
    await page.goBack();
    await page.waitForURL("**/t/list");
    await ready(page);
    expect(await firstFrame(page, "/t/list")).toEqual({
      layer: null,
      open: null,
      hidden: "visible",
    });
    // And the page is not marked as arriving: nothing would end that arrival.
    expect(await noted(page, "/t/list", "arriving")).toBeNull();
    expect(await noted(page, "/t/list", "arrival")).toBeNull();
  });

  test("linkBack() plays the way back for a link that leads back, with its own timing", async ({
    page,
    context,
  }) => {
    await serve(
      context,
      shop({
        options: `find: here(), use: [linkBack({ duration: 90 })],
          during: ({ timing, back }) => note("timing", { back, duration: timing.duration }),`,
      }),
    );
    await open(page);
    await forget(page);
    await page.click("#back");
    await page.waitForURL("**/t/list");
    await ready(page);
    expect(await noted(page, "/t/product", "leaving")).toBe("product-back");
    expect(await noted(page, "/t/list", "arriving")).toBe("product-back");
    expect(await firstFrame(page, "/t/list")).toEqual({
      layer: HERO_BOX,
      open: true,
      hidden: "hidden",
    });
    await swapped(page, "#thumb");
    expect(await noted(page, "/t/list", "timing")).toEqual({
      back: true,
      duration: 90,
    });
    // Without back(), the browser's Back plays nothing.
    await page.click("#card");
    await page.waitForURL("**/t/product");
    await swapped(page, "#hero");
    await forget(page);
    await page.goBack();
    await page.waitForURL("**/t/list");
    expect(await noted(page, "/t/list", "arriving")).toBeNull();
  });

  test("a link back puts the page where it was scrolled, unless told not to", async ({
    page,
    context,
  }) => {
    const long = {
      kernel: "core" as const,
      sheet: "none" as const,
      body: `<div style="height: 1500px"></div><div style="position: relative; height: 200px">${CARD}</div><div style="height: 1500px"></div>`,
    };
    for (const [use, scroll] of [
      [`linkBack()`, 1400],
      [`linkBack({ scroll: false })`, 0],
    ] as const) {
      await serve(
        context,
        shop({
          options: `use: [${use}],`,
          list: {
            ...long,
            // A script of the site's that reads the scroll as it starts, before the
            // morph's own module has run.
            head: `${HEAD_HALF}<script type="module">note("scroll a script saw", scrollY);</script>${morph(`use: [${use}],`)}`,
          },
        }),
      );
      await page.goto("/t/list");
      await ready(page);
      await page.evaluate(() => scrollTo(0, 1400));
      await page.click("#card");
      await page.waitForURL("**/t/product");
      await swapped(page, "#hero");
      await page.click("#back");
      await page.waitForURL("**/t/list");
      await ready(page);
      await swapped(page, "#thumb");
      expect(await page.evaluate(() => scrollY)).toBe(scroll);
      // Put there by the head script, as soon as the page was parsed.
      expect(await noted(page, "/t/list", "scroll a script saw")).toBe(scroll);
      await context.unrouteAll();
    }
  });

  test("with match, a link back plays from a page opened directly, to where its address leads", async ({
    page,
    context,
    browserName,
  }) => {
    const both = shop({
      options: `use: [linkBack({ match: ({ link }) => link.id === "back" })],`,
    });
    await serve(context, {
      list: {
        ...(both.list as PageSpec),
        body: `<div style="height: 1500px"></div><div id="shelf" style="position: relative; height: 200px">${CARD}</div><div style="height: 1500px"></div>`,
      },
      product: {
        ...(both.product as PageSpec),
        body: `${HERO}<a id="back" href="/t/list#shelf">back to the list</a>`,
      },
    });
    // No way out before it: the product page is where the visit starts.
    await page.goto("/t/product");
    await ready(page);
    await page.click("#back");
    await page.waitForURL("**/t/list#shelf");
    await ready(page);
    expect(await noted(page, "/t/product", "leaving")).toBe("product-back");
    expect(await noted(page, "/t/list", "arriving")).toBe("product-back");
    // The layer is on the first frame where the product page had its picture. Which
    // element it goes to is known only once the module has found the link.
    expect(await firstFrame(page, "/t/list")).toMatchObject({
      layer: HERO_BOX,
      open: true,
    });
    await swapped(page, "#thumb");
    // The page is where its address names, and the picture landed on its card there.
    // Read once the page has stopped: Firefox goes to a named place in two steps.
    await page.waitForLoadState("load");
    await page.waitForTimeout(300);
    const thumb = await boxOf(page, "#thumb");
    const shelf = await page.evaluate(() =>
      Math.abs(
        Math.round(
          (document.getElementById("shelf") as Element).getBoundingClientRect()
            .top,
        ),
      ),
    );
    // To the pixel: Firefox keeps the fraction of where the place is.
    expect(shelf).toBeLessThanOrEqual(1);
    expect(await noted(page, "/t/list", "during")).toMatchObject({
      back: true,
      hasLink: true,
      start: HERO_BOX,
    });
    // To the pixel in Chromium. Firefox may move the page one more pixel once it has
    // loaded, after the picture has landed (docs/morph.md, Limits).
    const stopped = (await noted(page, "/t/list", "stopped")) as number[];
    expect(Math.abs((stopped[1] ?? 0) - (thumb[1] ?? 0))).toBeLessThanOrEqual(
      browserName === "firefox" ? 1 : 0,
    );
    expect([stopped[0], stopped[2], stopped[3]]).toEqual([
      thumb[0],
      thumb[2],
      thumb[3],
    ]);
  });

  test("a link back with a place in its address goes there, not where the page was left", async ({
    page,
    context,
  }) => {
    const both = shop({ options: `use: [linkBack()],` });
    await serve(context, {
      list: {
        ...(both.list as PageSpec),
        body: `<div id="shelf" style="height: 1500px"></div><div style="position: relative; height: 200px">${CARD}</div><div style="height: 1500px"></div>`,
      },
      product: {
        ...(both.product as PageSpec),
        body: `${HERO}<a id="back" href="/t/list#shelf">back to the list</a>`,
      },
    });
    await page.goto("/t/list");
    await ready(page);
    await page.evaluate(() => scrollTo(0, 1400));
    await page.click("#card");
    await page.waitForURL("**/t/product");
    await swapped(page, "#hero");
    await page.click("#back");
    await page.waitForURL("**/t/list#shelf");
    await ready(page);
    await swapped(page, "#thumb");
    await page.waitForLoadState("load");
    await page.waitForTimeout(200);
    // The same in every browser: the address wins over where the page was left.
    expect(
      await page.evaluate(() =>
        Math.abs(
          Math.round(
            (
              document.getElementById("shelf") as Element
            ).getBoundingClientRect().top,
          ),
        ),
      ),
    ).toBeLessThanOrEqual(1);
    expect(await noted(page, "/t/list", "stopped")).toEqual(
      await boxOf(page, "#thumb"),
    );
  });

  test("back() still plays after the page reached was loaded again", async ({
    page,
    context,
  }) => {
    await serve(context, shop({ options: `find: here(), use: [back()],` }));
    await open(page);
    await page.reload();
    await ready(page);
    await forget(page);
    await page.goBack();
    await page.waitForURL("**/t/list");
    await ready(page);
    expect(await noted(page, "/t/list", "arriving")).toBe("product-back");
    await swapped(page, "#thumb");
    expect(await noted(page, "/t/list", "stopped")).toEqual(CARD_BOX);
  });

  test("a page never left by the morph plays no way back", async ({
    page,
    context,
  }) => {
    await serve(
      context,
      shop({ options: `find: here(), use: [back(), linkBack()],` }),
    );
    await page.goto("/t/product");
    await ready(page);
    await page.click("#back");
    await page.waitForURL("**/t/list");
    expect(await noted(page, "/t/list", "arriving")).toBe("page");
  });

  test("another morph leaving the page keeps its own layer", async ({
    page,
    context,
  }) => {
    // The product page has a second morph, to the next product, of the same template.
    const next = `<script type="module">
      import { defineMorph, here } from "/dist/morph.js";
      defineMorph("next", {
        from: (link) => (link.id === "next" ? link.querySelector("img") : null),
        to: "#hero",
        find: here(),
        duration: 100,
      });
    </script>`;
    const both = shop({ options: `use: [back()],` });
    const product = {
      ...(both.product as PageSpec),
      head: `${(both.product as PageSpec).head}${next}`,
      body: `${HERO}<a id="next" href="/t/other" style="position: absolute; left: 20px; top: 400px"><img alt="" src="${svg(120, 60)}" style="display: block; width: 120px; height: 60px"></a>`,
    };
    await serve(context, {
      list: both.list as PageSpec,
      product,
      other: { ...product, body: HERO },
    });
    await open(page);
    await page.click("#next");
    await page.waitForURL("**/t/other");
    expect(await noted(page, "/t/other", "arriving")).toBe("next");
    expect(await noted(page, "/t/other", "placed in the head")).toBe(true);
    await swapped(page, "#hero");
  });
});

test("a gallery: closing from another photo lands on that photo's thumbnail", async ({
  page,
  context,
}) => {
  await serve(
    context,
    gallery(`linkBack({ match: ({ link }) => link.matches(".close") })`),
  );
  await page.goto("/t/gallery");
  await ready(page);
  await page.click("#thumb-one");
  await page.waitForURL("**/t/one");
  await ready(page);
  await swapped(page, ".lightbox img");
  expect(await boxOf(page, ".lightbox img")).toEqual([200, 150, 300, 200]);
  await page.click("#next");
  await page.waitForURL("**/t/two");
  await ready(page);
  await page.click("#close");
  await page.waitForURL("**/t/gallery");
  await ready(page);
  expect(await noted(page, "/t/gallery", "arriving")).toBe("photo-back");
  await swapped(page, "#thumb-two img");
  expect(await noted(page, "/t/gallery", "back to")).toBe("thumb-two");
  expect(await noted(page, "/t/gallery", "stopped")).toEqual([140, 60, 80, 80]);
  // The first photo's thumbnail was not left hidden.
  expect(
    await page
      .locator("#thumb-one img")
      .evaluate((element) => getComputedStyle(element).visibility),
  ).toBe("visible");
});
