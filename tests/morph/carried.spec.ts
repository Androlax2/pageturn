/** pageturn/morph: what the package carries with no code of the site's: a held picture, an end where nothing shows, an element not laid out. */
import { expect, test } from "@playwright/test";
import { noted, serve } from "../support/site.ts";
import { CARD, HERO_END, morph, ready, shop, svg, swapped } from "./support.ts";

test.describe("what the package carries with no code", () => {
  test("a picture held larger than its frame is held on the layer, from one end's hold to the other's", async ({
    page,
    context,
  }) => {
    const frame = (id: string, style: string, zoom: string): string =>
      `<div id="${id}" style="${style}; overflow: hidden"><img alt="" src="${svg(120, 60)}" style="display: block; width: 100%; height: 100%; ${zoom}"></div>`;
    const card = `<a id="card" href="/t/product" style="position: absolute; left: 20px; top: 40px; display: block">${frame("thumb", "width: 120px; height: 60px", "scale: 1.2")}</a>`;
    const hero = frame(
      "hero",
      "position: absolute; left: 300px; top: 100px; width: 400px; height: 200px",
      "transform: scale(1.05)",
    );
    const options = `find: here(),
      during({ content, start, stop, finished }) {
        note("holds", [start.zoom, stop.zoom, getComputedStyle(content).scale]);
        finished.then(() => note("held", getComputedStyle(content).scale));
      },`;
    await serve(context, {
      list: {
        kernel: "core",
        sheet: "none",
        body: `${hero}${card.replace("top: 40px", "top: 400px")}`,
        head: morph(options),
      },
      product: { kernel: "core", sheet: "none", body: hero },
    });
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    const [from, to, atStart] = (await noted(page, "/t/list", "holds")) as [
      number,
      number,
      string,
    ];
    expect([from, to].map((zoom) => Math.round(zoom * 100))).toEqual([
      120, 105,
    ]);
    expect(Number.parseFloat(atStart)).toBeCloseTo(1.2, 2);
    expect(
      Number.parseFloat((await noted(page, "/t/list", "held")) as string),
    ).toBeCloseTo(1.05, 2);
  });

  test("an end where nothing shows: the layer fades in from it", async ({
    page,
    context,
  }) => {
    await serve(context, {
      ...shop({
        options: `find: () => (${HERO_END}),
          ends: ({ from }) => { from.opacity = 0; },
          during({ layer, finished }) {
            note("shows", getComputedStyle(layer).opacity);
            finished.then(() => note("shown", getComputedStyle(layer).opacity));
          },`,
      }),
    });
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    expect(await noted(page, "/t/list", "shows")).toBe("0");
    expect(await noted(page, "/t/list", "shown")).toBe("1");
  });

  test("an element that is not laid out starts from the end `ends` gives it", async ({
    page,
    context,
  }) => {
    // The card's picture is in the page and drawn nowhere until its link is clicked.
    const card = CARD.replace(
      '<img id="thumb"',
      '<span hidden><img id="thumb"',
    ).replace("</a>", "</span>card</a>");
    await serve(
      context,
      shop({
        options: `find: () => (${HERO_END}), use: [shadow()],
          ends({ from }) {
            // Both ways of writing a shadow: this one is a computed box-shadow.
            Object.assign(from, { box: { left: 40, top: 60, width: 80, height: 40 }, radius: 4, opacity: 0, shadow: "rgba(0, 0, 0, 0.5) 0px 10px 20px 0px" });
          },
          during: ({ layer, start }) => note("starts", {
            box: rounded(start.box),
            shows: getComputedStyle(layer).opacity,
            shadow: document.querySelector("[data-turn-shadow]").style.filter,
          }),`,
        list: { kernel: "core", sheet: "none", body: card },
      }),
    );
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    expect(await noted(page, "/t/list", "leaving")).toBe("product");
    expect(await noted(page, "/t/list", "starts")).toEqual({
      box: [40, 60, 80, 40],
      shows: "0",
      shadow: "drop-shadow(rgba(0, 0, 0, 0.5) 0px 10px 20px)",
    });
    await swapped(page, "#hero");
  });

  test("shadow() carries the shadow of the end that has one, under the layer, and lets go", async ({
    page,
    context,
  }) => {
    const card = CARD.replace(
      "border-radius: 6px",
      "border-radius: 6px; box-shadow: 0px 10px 20px 2px rgba(0, 0, 0, 0.5)",
    );
    await serve(
      context,
      shop({
        options: `find: () => (${HERO_END}), use: [shadow()], duration: 300,
          during({ layer, start, stop, finished }) {
            const around = document.querySelector("[data-turn-shadow]");
            const shape = around.firstElementChild;
            note("shadow", {
              ends: [start.shadow, stop.shadow ?? null],
              filter: around.style.filter,
              isUnder: layer.previousElementSibling === around,
              follows: shape.getAnimations().length === layer.getAnimations().length,
              sameBox: JSON.stringify(shape.getBoundingClientRect()) === JSON.stringify(layer.getBoundingClientRect()),
            });
            finished.then(() => setTimeout(() =>
              note("after", document.querySelectorAll("[data-turn-shadow]").length)));
          },`,
        list: { kernel: "core", sheet: "none", body: card },
        product: { stays: true },
      }),
    );
    await page.goto("/t/list");
    await ready(page);
    await page.evaluate(() => document.getElementById("card")?.click());
    await expect.poll(() => noted(page, "/t/list", "after")).toBe(0);
    expect(await noted(page, "/t/list", "shadow")).toEqual({
      ends: ["0px 10px 20px rgba(0, 0, 0, 0.5)", null],
      filter: "drop-shadow(rgba(0, 0, 0, 0.5) 0px 10px 20px)",
      isUnder: true,
      follows: true,
      sameBox: true,
    });
  });
});
