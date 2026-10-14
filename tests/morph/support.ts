/**
 * What the morph's specs share: the pages (a product card that grows into its product
 * page, a gallery whose thumbnails open a lightbox page, a headline that becomes its
 * article's title), and how to wait on a travel.
 */
import { expect, type Page } from "@playwright/test";
import { noted, type PageSpec } from "../support/site.ts";

export const svg = (width: number, height: number, fill = "teal"): string =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'%3E%3Crect width='${width}' height='${height}' fill='${fill}'/%3E%3C/svg%3E`;

/** The product's card in the list: the small end, inside its link. */
export const CARD = `<a id="card" href="/t/product" style="position: absolute; left: 20px; top: 40px; display: block; width: 120px"><img id="thumb" alt="" src="${svg(120, 60)}" style="display: block; width: 120px; height: 60px; border-radius: 6px"></a>`;

/** The product page's picture: the large end. */
export const HERO = `<img id="hero" alt="" src="${svg(120, 60)}" style="position: absolute; left: 300px; top: 100px; width: 400px; height: 200px; border-radius: 20px">`;

export const CARD_BOX = [20, 40, 120, 60];

export const HERO_BOX = [300, 100, 400, 200];

export const HERO_END = `{ box: { left: 300, top: 100, width: 400, height: 200 }, radius: 20 }`;

/** Notes what the page shows on its first frame: the layer, and the element it stands for. */
export const FIRST_FRAME = `<script>
  note("placed in the head", Boolean(document.querySelector("html > [data-turn-layer]")));
  requestAnimationFrame(() => {
    const layer = document.querySelector("html > [data-turn-layer]");
    const box = layer && layer.getBoundingClientRect();
    const target = document.querySelector("#hero") || document.querySelector("#thumb");
    note("first frame", {
      layer: box && [box.left, box.top, box.width, box.height].map(Math.round),
      open: layer ? layer.matches(":popover-open") : null,
      hidden: target ? getComputedStyle(target).visibility : null,
    });
  });
</script>`;

export const HEAD_HALF = `<script src="/dist/morph-head.js"></script>`;

/** The morph, the same module on every page, as a site would bundle it. */
export function morph(
  options = "",
  imports = "defineMorph, here, seen, turned, copy, back, linkBack, shadow",
): string {
  return `<script type="module">
  import { ${imports} } from "/dist/morph.js";
  const rounded = (box) => [box.left, box.top, box.width, box.height].map(Math.round);
  defineMorph("product", {
    from: (link) => (link.id === "card" ? link.querySelector("#thumb") : null),
    to: "#hero",
    duration: 150,
    during(play) {
      note("during", {
        back: play.back,
        hasLink: Boolean(play.link),
        start: rounded(play.start.box),
        stop: rounded(play.stop.box),
        radius: [play.start.radius, play.stop.radius].map(Math.round),
      });
      play.finished.then(() =>
        note("stopped", rounded(play.layer.getBoundingClientRect())));
    },
    ${options}
  });
  window.morphReady = true;
</script>`;
}

export interface Options {
  /** Options of the morph, as source. */
  options?: string;
  /** Without the head script's morph half: the module does its work, later. */
  noHead?: boolean;
  list?: PageSpec;
  product?: PageSpec;
}

/** The list, with the card, and the product page, with its picture. */
export function shop({
  options,
  noHead,
  list,
  product,
}: Options = {}): Record<string, PageSpec> {
  const head = `${noHead ? "" : HEAD_HALF}${FIRST_FRAME}${morph(options)}`;
  return {
    list: { kernel: "core", sheet: "none", head, body: CARD, ...list },
    product: {
      kernel: "core",
      sheet: "none",
      head,
      body: `${HERO}<a id="back" href="/t/list">back to the list</a>`,
      ...product,
    },
  };
}

export async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => "morphReady" in window);
}

export async function boxOf(page: Page, selector: string): Promise<number[]> {
  return page.locator(selector).evaluate((element) => {
    const { left, top, width, height } = element.getBoundingClientRect();
    return [left, top, width, height].map(Math.round);
  });
}

/** Resolves once the page shows its element again, with no layer over it. */
export async function swapped(page: Page, selector: string): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        (selector) => ({
          layers: document.querySelectorAll("html > [data-turn-layer]").length,
          visibility: getComputedStyle(
            document.querySelector(selector) as Element,
          ).visibility,
        }),
        selector,
      ),
    )
    .toEqual({ layers: 0, visibility: "visible" });
}

/** What the page at path showed on its first frame. */
export async function firstFrame(page: Page, path: string): Promise<unknown> {
  await expect.poll(() => noted(page, path, "first frame")).toBeDefined();
  return noted(page, path, "first frame");
}

export const forget = (page: Page): Promise<void> =>
  page.evaluate(() => sessionStorage.setItem("test-notes", "[]"));

/** From the list to the product page, the morph over. */
export async function open(page: Page): Promise<void> {
  await page.goto("/t/list");
  await ready(page);
  await page.click("#card");
  await page.waitForURL("**/t/product");
  await ready(page);
  await swapped(page, "#hero");
}

/** A gallery of square thumbnails, each opening a lightbox page with the whole photo. */
export function gallery(use: string): Record<string, PageSpec> {
  const head = `${HEAD_HALF}<script type="module">
    import { back, defineMorph, linkBack } from "/dist/morph.js";
    defineMorph("photo", {
      from: (link) => (link.matches(".gallery a") ? link.querySelector("img") : null),
      to: ".lightbox img",
      duration: 120,
      use: [${use}],
      during(play) {
        if (!play.back) return;
        note("back to", play.link.id);
        play.finished.then(() => note("stopped", [play.layer.getBoundingClientRect()].map(
          ({ left, top, width, height }) => [left, top, width, height].map(Math.round))[0]));
      },
    });
    window.morphReady = true;
  </script>`;
  const thumb = (name: string, left: number): string =>
    `<a id="thumb-${name}" href="/t/${name}" style="position: absolute; left: ${left}px; top: 60px"><img alt="" src="${svg(300, 200)}" style="display: block; width: 80px; height: 80px; object-fit: cover"></a>`;
  const photo = (next: string): PageSpec => ({
    kernel: "core",
    sheet: "none",
    head,
    body: `<div class="lightbox"><img alt="" src="${svg(300, 200)}" style="position: absolute; left: 200px; top: 150px; width: 300px; height: 200px"></div><a id="next" href="/t/${next}" data-turn="page">next</a> <a class="close" id="close" href="/t/gallery">close</a>`,
  });
  return {
    gallery: {
      kernel: "core",
      sheet: "none",
      head,
      body: `<div class="gallery">${thumb("one", 20)}${thumb("two", 140)}</div>`,
    },
    one: photo("two"),
    two: photo("one"),
  };
}

/** A headline in a list that becomes the title of its article. */
export const HEADLINE = `<a id="headline" href="/t/article" style="position: absolute; left: 20px; top: 40px; font: 16px/1 sans-serif; padding: 8px 16px; border-radius: 999px; background: rgb(255, 228, 196); color: rgb(0, 0, 128); text-decoration: none">A chair for life</a>`;

export const TITLE = `<h1 id="title" style="position: absolute; left: 100px; top: 150px; margin: 0; font: 700 64px/1 sans-serif; color: rgb(0, 0, 0)">A chair for life</h1><a id="back" href="/t/news">back</a>`;

export function headline(options: string): string {
  return `${FIRST_FRAME}<script type="module">
  import { behind, defineMorph, peek, linkBack, text } from "/dist/morph.js";
  const rounded = (box) => [box.left, box.top].map(Math.round);
  defineMorph("read", {
    from: (link) => (link.id === "headline" ? link : null),
    to: "#title",
    as: text(),
    duration: 150,
    during(play) {
      note("during", {
        back: play.back,
        words: play.content.textContent,
        sizes: [play.start.text.type.fontSize, play.stop.text.type.fontSize],
        fills: [play.start.background, play.stop.background],
        stop: rounded(play.stop.text.box),
        behind: play.behind?.localName ?? null,
        behindShows: play.behind
          ? getComputedStyle(play.behind.contentDocument.getElementById("headline")).visibility
          : null,
      });
      note("started at", rounded(play.start.text.box));
      play.finished.then(() => {
        const range = document.createRange();
        range.selectNodeContents(play.content);
        const style = getComputedStyle(play.layer);
        const fill = play.layer.lastElementChild;
        note("box", {
          at: [fill.getBoundingClientRect()].map(({ left, top, width, height }) => [left, top, width, height].map(Math.round))[0],
          fill: getComputedStyle(fill).backgroundColor,
        });
        note("stopped exactly", range.getBoundingClientRect().top - play.stop.text.box.top);
        note("stopped", {
          glyphs: rounded(range.getBoundingClientRect()),
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          color: style.color,
        });
      });
    },
    ${options}
  });
  window.morphReady = true;
</script>`;
}

export function news(options: string): Record<string, PageSpec> {
  const head = `${HEAD_HALF}${headline(options)}`;
  return {
    news: { kernel: "core", sheet: "none", head, body: HEADLINE },
    article: { kernel: "core", sheet: "none", head, body: TITLE },
  };
}

export const glyphsOf = (page: Page, id: string): Promise<number[]> =>
  page.evaluate((id) => {
    const range = document.createRange();
    range.selectNodeContents(document.getElementById(id) as Element);
    const { left, top } = range.getBoundingClientRect();
    return [left, top].map(Math.round);
  }, id);
