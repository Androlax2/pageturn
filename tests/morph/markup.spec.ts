/**
 * A morph from the markup, `data-turn-morph` on both
 * elements and no script of the site's, with pageturn/morph/markup or pageturn-morph.js.
 */
import { expect, type Page, test } from "@playwright/test";
import { noted, type PageSpec, serve } from "../support/site.ts";

const svg = (width: number, height: number): string =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="teal"/></svg>`)}`;

/** Three cards of one name; the click says which travels. */
const CARDS = [1, 2, 3]
  .map(
    (n) =>
      `<a id="card${n}" href="/t/product" style="position: absolute; left: ${20 + 140 * (n - 1)}px; top: 40px; display: block; width: 120px"><img id="thumb${n}" data-turn-morph="product" alt="" src="${svg(120, 60)}" style="display: block; width: 120px; height: 60px"></a>`,
  )
  .join("");
const HERO = `<img id="hero" data-turn-morph="product" alt="" src="${svg(120, 60)}" style="position: absolute; left: 300px; top: 160px; width: 400px; height: 200px">`;

/** What the page shows as soon as it is parsed, and whether a layer is above it. */
const WATCH = `<script>
  document.addEventListener("readystatechange", () => {
    const origin = document.querySelector("[data-turn-origin]");
    note("at once", {
      origin: origin ? origin.id : null,
      layer: document.querySelectorAll("html > [data-turn-layer]").length,
    });
    const copy = document.querySelector("html > [data-turn-layer] img");
    if (copy) note("copy shown", getComputedStyle(copy).visibility);
  }, { once: true });
</script>`;

const MODULES = `<script src="/dist/morph-head.js"></script>${WATCH}<script type="module" src="/dist/morph-markup.js"></script>`;

function pages(extra = ""): { list: PageSpec; product: PageSpec } {
  return {
    list: { kernel: "core", sheet: "none", head: MODULES + extra, body: CARDS },
    product: {
      kernel: "core",
      sheet: "none",
      head: MODULES + extra,
      body: HERO,
    },
  };
}

/** Resolves once no layer is left over the page. */
async function landed(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelectorAll("html > [data-turn-layer]").length,
      ),
    )
    .toBe(0);
}

test("the card clicked grows into the page reached, and back into its place on Back", async ({
  page,
  context,
}) => {
  await serve(context, pages());
  await page.goto("/t/list");
  await page.waitForLoadState("load");
  await page.click("#card2");
  await page.waitForURL("**/t/product");
  expect(await noted(page, "/t/list", "leaving")).toBe("product");
  expect(await noted(page, "/t/product", "arriving")).toBe("product");
  // On the page reached's first frame, the layer is there already.
  expect(await noted(page, "/t/product", "at once")).toMatchObject({
    layer: 1,
  });
  // The rule that hides the element under the layer leaves the layer's copy of it shown.
  expect(await noted(page, "/t/product", "copy shown")).toBe("visible");
  await landed(page);

  await page.goBack();
  await page.waitForURL("**/t/list");
  expect(await noted(page, "/t/list", "arriving")).toBe("product-back");
  // Back to the card it left from, the second of three of the same name.
  expect(await noted(page, "/t/list", "at once")).toEqual({
    origin: "thumb2",
    layer: 1,
  });
  await landed(page);
});

test("a defineMorph of the same name is the site's: the markup's is left to it", async ({
  page,
  context,
}) => {
  const own = `<script type="module">
    import { defineMorph } from "/dist/morph.js";
    defineMorph("product", {
      from: (link) => link.querySelector("[data-turn-morph]"),
      to: "#hero",
      during: () => note("mine", true),
    });
  </script>`;
  await serve(context, pages(own));
  await page.goto("/t/list");
  await page.waitForLoadState("load");
  await page.click("#card1");
  await page.waitForURL("**/t/product");
  await expect.poll(() => noted(page, "/t/product", "mine")).toBe(true);
  await landed(page);
});

test("pageturn-morph.js: the same with no bundler, and the morph on window.pageturn", async ({
  page,
  context,
}) => {
  const classic = `<script src="/dist/pageturn-morph.js"></script>${WATCH}`;
  await serve(context, {
    list: { head: classic, body: CARDS },
    product: { head: classic, body: HERO },
  });
  await page.goto("/t/list");
  await page.waitForLoadState("load");
  expect(
    await page.evaluate(() => typeof window.pageturn?.morph?.defineMorph),
  ).toBe("function");
  await page.click("#card3");
  await page.waitForURL("**/t/product");
  expect(await noted(page, "/t/product", "arriving")).toBe("product");
  expect(await noted(page, "/t/product", "at once")).toMatchObject({
    layer: 1,
  });
  await landed(page);
  await page.goBack();
  await page.waitForURL("**/t/list");
  expect(await noted(page, "/t/list", "at once")).toEqual({
    origin: "thumb3",
    layer: 1,
  });
});

test("a morph defined from the head, before the body, lands once the page is parsed", async ({
  page,
  context,
}) => {
  const classic = `<script src="/dist/pageturn-morph.js"></script>
  <script>
    window.pageturn.morph.defineMorph("hero", {
      from: (link) => link.querySelector("img"),
      to: "#hero",
      during: () => note("travelled", location.pathname),
    });
  </script>`;
  const card = CARDS.replaceAll('data-turn-morph="product" ', "");
  await serve(context, {
    list: { head: classic, body: card },
    product: {
      head: classic,
      body: HERO.replace('data-turn-morph="product" ', ""),
    },
  });
  await page.goto("/t/list");
  await page.waitForLoadState("load");
  await page.click("#card1");
  await page.waitForURL("**/t/product");
  expect(await noted(page, "/t/product", "arriving")).toBe("hero");
  // The travel plays on the page reached: no finder said where it lands.
  await expect
    .poll(() => noted(page, "/t/product", "travelled"))
    .toBe("/t/product");
  await landed(page);
});

test("the list's own cards are not taken for where the picture lands", async ({
  page,
  context,
}) => {
  // The list shows the name too, on every card: seen() must not read it as the product
  // page's. The first time, the layer is handed over where the clicked card is.
  const handedOver = `<script>
    addEventListener("pagehide", () => {
      const layer = document.querySelector("html > [data-turn-layer]");
      const box = layer && layer.getBoundingClientRect();
      note("layer handed over at", box && [box.left, box.top, box.width, box.height].map(Math.round));
    });
  </script>`;
  const site = pages(handedOver);
  await serve(context, { ...site, other: site.product });
  await page.goto("/t/list");
  await page.waitForLoadState("load");
  await page.click("#card2");
  await page.waitForURL("**/t/product");
  // Handed over where the clicked card is: it held still, with no estimate to go to.
  await expect
    .poll(() => noted(page, "/t/list", "layer handed over at"))
    .toEqual([160, 40, 120, 60]);
  await landed(page);

  // Seen once on a product page: another product, of the same template, is travelled to
  // on the page left, and is in place as the page changes.
  await page.goBack();
  await page.waitForURL("**/t/list");
  await landed(page);
  await page.evaluate(() => {
    const card = document.querySelector<HTMLAnchorElement>("#card3");
    if (card) card.href = "/t/other";
  });
  await page.click("#card3");
  await page.waitForURL("**/t/other");
  expect(await noted(page, "/t/list", "layer handed over at")).toEqual([
    300, 160, 400, 200,
  ]);
  await landed(page);
});
