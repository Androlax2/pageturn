/** pageturn/morph: what a site configures instead of writing: `text({ swap, box })`, `data-turn-back`, the page put back. */
import { expect, test } from "@playwright/test";
import {
  endTravel,
  seekTravel,
  layer as travelling,
} from "../../src/testing/testing.ts";
import { noted, type PageSpec, serve } from "../support/site.ts";
import {
  boxOf,
  CARD,
  forget,
  HEAD_HALF,
  HERO,
  morph,
  open,
  ready,
  shop,
  swapped,
} from "./support.ts";

test.describe("what a site configures instead of writing", () => {
  /** A link whose words are not the title's: "Speak to us" becomes "Spoke to us". */
  const says = (options: string, kind = ""): Record<string, PageSpec> => {
    const head = (extra = "") => `${HEAD_HALF}${extra}<script type="module">
      import { defineMorph, linkBack, text } from "/dist/morph.js";
      defineMorph("say", {
        from: (link) => (link.id === "say" ? link : null),
        to: "#said",
        as: text(${kind}),
        duration: 300,
        ${options}
      });
      window.morphReady = true;
    </script>`;
    return {
      news: {
        kernel: "core",
        sheet: "none",
        head: head(),
        body: `<a id="say" href="/t/article" style="position: absolute; left: 20px; top: 40px; font: 16px/1 sans-serif; padding: 8px 16px; border-radius: 999px; background: rgb(255, 228, 196); text-decoration: none">Speak to us</a>`,
      },
      article: {
        kernel: "core",
        sheet: "none",
        head: head(),
        css: `#said { position: absolute; left: 100px; top: 150px; margin: 0; font: 700 64px/1 sans-serif } #said::before { content: ""; position: absolute; inset: 2px -4px -6px; border-radius: 3px }`,
        body: `<h1 id="said">Spoke to us</h1>`,
      },
    };
  };
  const END = `find: () => null,`;

  test("words that differ between the two ends: what they share stays, the rest changes", async ({
    page,
    context,
  }) => {
    const both = says(`find: (to, selector, measure) => window.titleEnd,`);
    await serve(context, {
      ...both,
      // Held on the page left, to look at the layer there.
      article: { stays: true },
      measured: both.article as PageSpec,
    });
    // Where the title is, read on its own page first.
    await page.goto("/t/measured");
    await page.waitForFunction(() => "morphReady" in window);
    const title = await page.evaluate(() => {
      const range = document.createRange();
      range.selectNodeContents(document.getElementById("said") as Element);
      const { left, top, right } = range.getBoundingClientRect();
      const style = getComputedStyle(
        document.getElementById("said") as Element,
      );
      return {
        glyphs: { left, top, right },
        end: {
          box: (document.getElementById("said") as Element)
            .getBoundingClientRect()
            .toJSON(),
          radius: 0,
          background: "rgba(0, 0, 0, 0)",
          text: {
            box: { left, top, width: right - left, height: 64 },
            type: {
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              fontStretch: style.fontStretch,
              letterSpacing: "0px",
              fontVariationSettings: '"opsz" 64',
            },
            color: style.color,
            words: "Spoke to us",
          },
        },
      };
    });
    await page.goto("/t/news");
    await ready(page);
    await page.evaluate((end) => {
      Object.assign(window, { titleEnd: end });
    }, title.end);
    await page.evaluate(() => document.getElementById("say")?.click());
    const moving = travelling(page);
    await expect(moving.root).toHaveCount(1);
    // In parts, by name, and nothing of the site's wrote them.
    await expect(moving.part("head")).toHaveText("Sp");
    await expect(moving.part("leaving")).toHaveText("eak");
    await expect(moving.part("arriving")).toHaveText("oke");
    await expect(moving.part("rest")).toHaveText(" to us");
    // At the start the link's word shows; at the end, the title's, on the title's glyphs.
    expect(await seekTravel(page, 0)).toBe(true);
    await expect(moving.part("leaving")).toHaveCSS("opacity", "1");
    await expect(moving.part("arriving")).toHaveCSS("opacity", "0");
    expect(await endTravel(page)).toBe(true);
    await expect(moving.part("leaving")).toHaveCSS("opacity", "0");
    await expect(moving.part("arriving")).toHaveCSS("opacity", "1");
    const landed = await page.evaluate(() => {
      const edge = (name: string, side: "left" | "right" | "top") => {
        const range = document.createRange();
        range.selectNodeContents(
          document.querySelector(`[data-turn-part="${name}"]`) as Element,
        );
        return range.getBoundingClientRect()[side];
      };
      return {
        left: edge("head", "left"),
        top: edge("head", "top"),
        right: edge("rest", "right"),
      };
    });
    expect(Math.abs(landed.left - title.glyphs.left)).toBeLessThan(0.5);
    expect(Math.abs(landed.top - title.glyphs.top)).toBeLessThan(0.5);
    // What follows the changed word ends where the title's does: it slid by the right amount.
    expect(Math.abs(landed.right - title.glyphs.right)).toBeLessThan(0.5);
  });

  test("swap gives the changing word its own keyframes, and a clip for where it passes", async ({
    page,
    context,
  }) => {
    const both = says(
      END,
      `{ swap: ({ back }) => ({
        leave: [{ translate: "0 0" }, { translate: "0 -110%" }],
        arrive: [{ translate: "0 110%" }, { translate: "0 0" }],
        clip: "inset(-1px)",
        duration: back ? 100 : 200,
      }) }`,
    );
    await serve(context, both);
    await page.goto("/t/news");
    await ready(page);
    await page.click("#say");
    await page.waitForURL("**/t/article");
    // No finder: the travel plays on the page reached, and so does the change of word.
    const moving = travelling(page);
    await expect(moving.part("arriving")).toHaveText("oke");
    expect(
      await moving.part("arriving").evaluate((word) => ({
        clip: (word.parentElement as HTMLElement).style.clipPath,
        duration: word.getAnimations()[0]?.effect?.getComputedTiming().duration,
        fades: word
          .getAnimations()
          .some((animation) =>
            (animation.effect as KeyframeEffect)
              .getKeyframes()
              .some((frame) => "opacity" in frame),
          ),
      })),
    ).toEqual({ clip: "inset(-1px)", duration: 200, fades: false });
    await swapped(page, "#said");
  });

  test("box: the box that travels is a pseudo-element's, read where the title is, for one end or both", async ({
    page,
    context,
  }) => {
    const noting = `${END} during: ({ start, stop }) => note("boxes", {
      from: [start.box.left, start.box.top, start.box.width, start.box.height].map(Math.round),
      fill: start.background,
      to: [stop.box.left, stop.box.top, stop.box.width, stop.box.height].map(Math.round),
      radius: stop.radius,
    }),`;
    // The link has a pseudo-element of its own, for something else: a hover's overlay.
    const overlay = `#say { position: absolute } #say::before { content: ""; position: absolute; inset: 3px; background: rgb(1, 2, 3); opacity: 0 }`;
    for (const [kind, from, fill] of [
      // Named for the title's end only: the link's end is its own box and fill.
      [`{ box: { to: "::before" } }`, [20, 40], "rgb(255, 228, 196)"],
      // Named for both: the link's is read from its overlay, inside its box.
      [`{ box: "::before" }`, [23, 43], "rgb(1, 2, 3)"],
    ] as const) {
      const both = says(noting, kind);
      await serve(context, {
        news: { ...(both.news as PageSpec), css: overlay },
        article: both.article as PageSpec,
      });
      await page.goto("/t/news");
      await ready(page);
      await page.click("#say");
      await page.waitForURL("**/t/article");
      await swapped(page, "#said");
      const [left = 0, top = 0, width = 0, height = 0] = await boxOf(
        page,
        "#said",
      );
      const boxes = (await noted(page, "/t/article", "boxes")) as {
        from: number[];
        fill: string;
      };
      // inset: 2px -4px -6px, around the title's own box.
      expect(boxes).toMatchObject({
        to: [left - 4, top + 2, width + 8, height + 4],
        radius: 3,
        fill,
      });
      expect(boxes.from.slice(0, 2)).toEqual(from);
      await context.unrouteAll();
    }
  });

  test("data-turn-back: a link written to lead home leads where the way out started, and plays it back", async ({
    page,
    context,
  }) => {
    const both = shop({ options: `find: here(), use: [linkBack()],` });
    await serve(context, {
      list: both.list as PageSpec,
      product: {
        ...(both.product as PageSpec),
        // Inside something that says "no move": the link names its own.
        body: `${HERO}<div data-turn="none"><a id="close" href="/t/home" data-turn-back="product" data-turn-back-label="Back to where you were">Close</a></div>`,
      },
      home: { kernel: "core", sheet: "none" },
    });
    // Opened directly: it leads where it was written to.
    await page.goto("/t/product");
    await ready(page);
    expect(
      await page.locator("#close").evaluate((link: HTMLAnchorElement) => ({
        to: link.pathname,
        label: link.getAttribute("aria-label"),
      })),
    ).toEqual({ to: "/t/home", label: null });
    await open(page);
    expect(
      await page.locator("#close").evaluate((link: HTMLAnchorElement) => ({
        to: link.pathname,
        label: link.getAttribute("aria-label"),
      })),
    ).toEqual({ to: "/t/list", label: "Back to where you were" });
    await forget(page);
    await page.click("#close");
    await page.waitForURL("**/t/list");
    expect(await noted(page, "/t/product", "leaving")).toBe("product-back");
    expect(await noted(page, "/t/list", "arriving")).toBe("product-back");
    await ready(page);
    await swapped(page, "#thumb");
  });

  test("the page returned to is put back: the element marked, its popover open, before the site's scripts", async ({
    page,
    context,
  }) => {
    const options = `use: [linkBack()],`;
    // What a script of the site sees as soon as the page is parsed, after the package's.
    const seesAtOnce = `<script>
      document.addEventListener("readystatechange", () => {
        const origin = document.querySelector("[data-turn-origin]");
        note("at once", {
          origin: origin && origin.id + " of " + origin.getAttribute("data-turn-origin"),
          menu: Boolean(document.querySelector("#menu:popover-open")),
          restoring: "turnRestoring" in document.documentElement.dataset,
        });
      }, { once: true });
    </script>`;
    const both = shop({ options });
    await serve(context, {
      list: {
        ...(both.list as PageSpec),
        head: `${HEAD_HALF}${seesAtOnce}${morph(options)}`,
        body: `<button id="opens" popovertarget="menu">menu</button><div id="menu" popover="manual" style="inset: 80px auto auto 20px; width: 300px; height: 200px">${CARD}</div>`,
      },
      product: both.product as PageSpec,
    });
    await page.goto("/t/list");
    await ready(page);
    await page.click("#opens");
    await page.click("#card");
    await page.waitForURL("**/t/product");
    await ready(page);
    await swapped(page, "#hero");
    await forget(page);
    await page.click("#back");
    await page.waitForURL("**/t/list");
    await ready(page);
    expect(await noted(page, "/t/list", "at once")).toEqual({
      origin: "thumb of product",
      menu: true,
      restoring: true,
    });
    await swapped(page, "#thumb");
    // Once it is drawn and the picture has landed, the marks are gone.
    await expect
      .poll(() =>
        page.evaluate(() => ({
          origin: document.querySelectorAll("[data-turn-origin]").length,
          restoring: "turnRestoring" in document.documentElement.dataset,
          menu: Boolean(document.querySelector("#menu:popover-open")),
        })),
      )
      .toEqual({ origin: 0, restoring: false, menu: true });
  });

  test("a page that only has the `to` element defines the morph without `from`", async ({
    page,
    context,
  }) => {
    const both = shop({ options: `use: [back()],` });
    await serve(context, {
      list: both.list as PageSpec,
      product: {
        ...(both.product as PageSpec),
        head: `${HEAD_HALF}<script type="module">
          import { back, defineMorph } from "/dist/morph.js";
          defineMorph("product", { to: "#hero", duration: 150, use: [back()] });
          window.morphReady = true;
        </script>`,
      },
    });
    await open(page);
    await page.goBack();
    await page.waitForURL("**/t/list");
    await ready(page);
    expect(await noted(page, "/t/list", "arriving")).toBe("product-back");
    await swapped(page, "#thumb");
  });
});
