/** pageturn/morph: `turned()` and `copy()`. */
import { expect, test } from "@playwright/test";
import { noted, serve } from "../support/site.ts";
import {
  CARD,
  HEAD_HALF,
  HERO,
  HERO_BOX,
  HERO_END,
  morph,
  ready,
  swapped,
} from "./support.ts";

test.describe("turned() and copy()", () => {
  test("turned() reads an element as it is drawn, leaning; without it, the rectangle around it", async ({
    page,
    context,
  }) => {
    const read = (imports: string, use: string) => `<script type="module">
      import { ${imports} } from "/dist/morph.js";
      defineMorph("product", {
        from: (link) => (link.id === "card" ? link.querySelector("#thumb") : null),
        to: "#hero",
        ${use}
        ends({ from }) {
          note("read", [from.box.width, from.box.height, from.rotate ?? 0, from.radius].map(Math.round));
        },
      });
      window.morphReady = true;
    </script>`;
    const leaning = {
      kernel: "core" as const,
      sheet: "none" as const,
      css: `#card:hover #thumb { scale: 1.5; rotate: 10deg }`,
      body: CARD,
    };
    await serve(context, {
      list: {
        ...leaning,
        head: read("defineMorph, turned", "use: [turned()],"),
      },
      flat: { ...leaning, head: read("defineMorph", "") },
      product: { kernel: "core", sheet: "none", body: HERO },
    });
    for (const [name, expected] of [
      ["list", [180, 90, 10, 9]],
      // 120 × 60 at 1.5 and 10 degrees fits in a rectangle of 193 × 120.
      ["flat", [193, 120, 0, 6]],
    ] as const) {
      await page.goto(`/t/${name}`);
      await ready(page);
      await page.hover("#card");
      await page.click("#card");
      await page.waitForURL("**/t/product");
      expect(await noted(page, `/t/${name}`, "read")).toEqual(expected);
    }
  });

  test("copy() stretches a copy of the element, with what it contains", async ({
    page,
    context,
  }) => {
    const card = `<a id="card" href="/t/product" style="position: absolute; left: 20px; top: 40px; display: block; width: 120px; text-decoration: none"><div id="thumb" style="width: 120px; height: 60px; border-radius: 6px; background: teal">A chair</div></a>`;
    const header = `<div id="hero" style="position: absolute; left: 300px; top: 100px; width: 400px; height: 200px; border-radius: 20px; background: teal">A chair</div>`;
    const options = `as: copy(), find: () => (${HERO_END}),
      during({ layer, content, finished }) {
        const style = getComputedStyle(layer);
        note("copy", { scale: style.scale, width: style.width, words: content.textContent, id: content.id });
        finished.then(() => note("stopped", rounded(layer.getBoundingClientRect())));
      },`;
    await serve(context, {
      list: {
        kernel: "core",
        sheet: "none",
        body: card,
        head: morph(options),
      },
      product: {
        kernel: "core",
        sheet: "none",
        body: header,
        head: `${HEAD_HALF}${morph(options)}`,
      },
    });
    await page.goto("/t/list");
    await ready(page);
    await page.click("#card");
    await page.waitForURL("**/t/product");
    // At its own size, stretched to the other end's box; its copy answers to no id.
    expect(await noted(page, "/t/list", "copy")).toMatchObject({
      width: "120px",
      words: "A chair",
      id: "",
    });
    expect(await noted(page, "/t/list", "stopped")).toEqual(HERO_BOX);
    await swapped(page, "#hero");
  });
});
