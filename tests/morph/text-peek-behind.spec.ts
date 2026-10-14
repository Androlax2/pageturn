/** pageturn/morph: `text()`, `peek()` and `behind()`. */
import { expect, test } from "@playwright/test";
import { noted, type PageSpec, serve } from "../support/site.ts";
import {
  boxOf,
  firstFrame,
  forget,
  glyphsOf,
  HEAD_HALF,
  HEADLINE,
  headline,
  news,
  ready,
  swapped,
} from "./support.ts";

test.describe("text(), peek() and behind()", () => {
  test("text() sets the words again in the type of the title, found by peek() as the link is approached", async ({
    page,
    context,
  }) => {
    const site = await serve(context, news(`find: peek(),`));
    await page.goto("/t/news");
    await ready(page);
    expect(site.requests.get("article")).toBeUndefined();
    await page.hover("#headline");
    await expect.poll(() => site.requests.get("article")).toBe(1);
    await page.click("#headline");
    await page.waitForURL("**/t/article");
    // The page was looked at once, and the frame is gone.
    expect(site.requests.get("article")).toBe(2);
    const title = await glyphsOf(page, "title");
    expect(await noted(page, "/t/news", "during")).toEqual({
      back: false,
      words: "A chair for life",
      sizes: ["16px", "64px"],
      fills: ["rgb(255, 228, 196)", "rgba(0, 0, 0, 0)"],
      stop: title,
      behind: null,
      behindShows: null,
    });
    // Real text, where the title's own glyphs are, in its type.
    expect(await noted(page, "/t/news", "stopped")).toEqual({
      glyphs: title,
      fontSize: "64px",
      fontWeight: "700",
      color: "rgb(0, 0, 0)",
    });
    // To a fraction of a pixel, at a size six times the one it started from.
    expect(
      Math.abs((await noted(page, "/t/news", "stopped exactly")) as number),
    ).toBeLessThan(0.25);
    // The headline's pill went with its words, to the title's own box, and faded out.
    expect(await noted(page, "/t/news", "box")).toEqual({
      at: await boxOf(page, "#title"),
      fill: "rgba(0, 0, 0, 0)",
    });
    await swapped(page, "#title");
  });

  test("the page reached asks `ends` too, and corrects nothing when the layer is where the hook put it", async ({
    page,
    context,
  }) => {
    // The title end keeps the headline's colours, and its box is a band of the site's.
    const both = news(`find: peek(),
      ends({ from, to }) {
        if (!to) return;
        to.box = { left: to.box.left - 4, top: to.box.top + 2, width: to.box.width + 8, height: to.box.height - 6 };
        to.background = from.background;
        to.text.color = from.text.color;
      },`);
    await serve(context, both);
    await page.addInitScript(() => {
      if (location.pathname !== "/t/article") return;
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...given) {
        if (this.closest("[data-turn-layer]")) {
          sessionStorage.setItem("corrected", "yes");
        }
        return animate.apply(this, given);
      };
    });
    await page.goto("/t/news");
    await ready(page);
    await page.hover("#headline");
    await page.click("#headline");
    await page.waitForURL("**/t/article");
    await swapped(page, "#title");
    expect(
      await page.evaluate(() => sessionStorage.getItem("corrected")),
    ).toBeNull();
    expect(await noted(page, "/t/news", "box")).toMatchObject({
      fill: "rgb(255, 228, 196)",
    });
  });

  test("a peek() that does not answer in time leaves the travel to the page reached, or to `ends`", async ({
    page,
    context,
  }) => {
    await serve(context, {
      ...news(`find: peek({ wait: 1, warm: false }),`),
      strict: {
        kernel: "core",
        sheet: "none",
        body: HEADLINE,
        head: headline(
          `find: peek({ wait: 1, warm: false }), ends: ({ to }) => to !== null,`,
        ),
      },
    });
    await page.goto("/t/news");
    await ready(page);
    await page.click("#headline");
    await page.waitForURL("**/t/article");
    await swapped(page, "#title");
    expect(await noted(page, "/t/article", "during")).toMatchObject({
      sizes: ["16px", "64px"],
    });

    await page.goto("/t/strict");
    await ready(page);
    await forget(page);
    await page.click("#headline");
    await page.waitForURL("**/t/article");
    expect(await noted(page, "/t/article", "arriving")).toBe("page");
    expect(await firstFrame(page, "/t/article")).toMatchObject({ layer: null });
  });

  test("a link back from an element that is not laid out: `ends` gives it another's place", async ({
    page,
    context,
  }) => {
    // A later step of the article: its title is not shown, a heading is.
    const both = news(`find: peek(), use: [linkBack(), behind()],
      ends({ to }, { back, measure }) {
        const title = document.getElementById("title");
        if (back && title && title.getClientRects().length === 0) {
          Object.assign(to, measure(title, document.getElementById("step")));
        }
      },`);
    await serve(context, both);
    await page.goto("/t/news");
    await ready(page);
    await page.hover("#headline");
    await page.click("#headline");
    await page.waitForURL("**/t/article");
    await ready(page);
    await swapped(page, "#title");
    await page.evaluate(() => {
      (document.getElementById("title") as HTMLElement).style.display = "none";
      document.body.insertAdjacentHTML(
        "beforeend",
        `<h2 id="step" style="position: absolute; left: 60px; top: 220px; margin: 0; font: 24px/1 sans-serif">Step two</h2>`,
      );
    });
    const step = await glyphsOf(page, "step");
    await forget(page);
    await page.click("#back");
    await page.waitForURL("**/t/news");
    expect(await noted(page, "/t/article", "leaving")).toBe("read-back");
    // The title's own words and type, drawn where the heading's words start.
    const during = (await noted(page, "/t/article", "during")) as {
      words: string;
      sizes: string[];
    };
    expect(during).toMatchObject({
      back: true,
      words: "A chair for life",
      sizes: ["64px", "16px"],
    });
    expect(
      await page.evaluate(
        () =>
          JSON.parse(sessionStorage.getItem("test-notes") ?? "[]").find(
            (note: { key: string }) => note.key === "started at",
          )?.value,
      ),
    ).toEqual(step);
  });

  test("a way out is forgotten when its page is reached another way, or when the site says so", async ({
    page,
    context,
  }) => {
    await serve(context, news(`use: [linkBack()],`));
    const kept = () =>
      page.evaluate(async () => {
        const { wayOut } = await import("/dist/morph.js" as string);
        return wayOut("read")?.page ?? null;
      });
    await page.goto("/t/news");
    await ready(page);
    await page.click("#headline");
    await page.waitForURL("**/t/article");
    await ready(page);
    expect(await kept()).toBe("/t/news");
    // A reload keeps it: the visitor is still on the visit the way out started.
    await page.reload();
    await ready(page);
    expect(await kept()).toBe("/t/news");
    // Reached again by the address bar: the way out is not how the visitor came.
    await page.goto("/t/news");
    await ready(page);
    expect(await kept()).toBe("/t/news");
    await page.goto("/t/article");
    await ready(page);
    expect(await kept()).toBeNull();
    // And the link back, which had no match of its own, is a plain link again.
    await page.click("#back");
    await page.waitForURL("**/t/news");
    expect(await noted(page, "/t/news", "arriving")).toBe("page");

    // The site may also say a way out is over.
    await ready(page);
    await page.click("#headline");
    await page.waitForURL("**/t/article");
    await ready(page);
    expect(await kept()).toBe("/t/news");
    await page.evaluate(async () => {
      const { forgetWayOut } = await import("/dist/morph.js" as string);
      forgetWayOut("read");
    });
    expect(await kept()).toBeNull();
  });

  test("behind(): a link back travels before leaving, to where it started, with the page reached behind", async ({
    page,
    context,
  }) => {
    const options = `find: peek(), use: [linkBack(), behind()], data: () => ({ tone: "warm" }),`;
    const both = news(options);
    await serve(context, {
      news: {
        ...(both.news as PageSpec),
        // A script of the page that reads the scroll as it starts, in the copy behind.
        head: `${HEAD_HALF}<script>if (window.top !== window) note("what the copy's head was told", window.pageturn.behind);</script><script type="module">if (window.top !== window) note("scroll the copy's script saw", scrollY);</script>${headline(options)}`,
        body: `<div style="height: 1500px"></div><div style="position: relative; height: 200px">${HEADLINE}</div><div style="height: 1500px"></div>`,
      },
      article: both.article as PageSpec,
    });
    await page.goto("/t/news");
    await ready(page);
    await page.evaluate(() => scrollTo(0, 1400));
    const link = await glyphsOf(page, "headline");
    await page.click("#headline");
    await page.waitForURL("**/t/article");
    await ready(page);
    await swapped(page, "#title");
    // Where the way out started, and what the site said then, kept for the tab.
    expect(
      await page.evaluate(async () => {
        const { wayOut } = await import("/dist/morph.js" as string);
        return wayOut("read");
      }),
    ).toEqual({
      page: "/t/news",
      scroll: { x: 0, y: 1400 },
      data: { tone: "warm" },
    });
    await forget(page);
    await page.click("#back");
    await page.waitForURL("**/t/news");
    await ready(page);
    expect(await noted(page, "/t/article", "leaving")).toBe("read-back");
    // The copy behind was where the page was left before its own scripts ran.
    expect(await noted(page, "/t/news", "scroll the copy's script saw")).toBe(
      1400,
    );
    // In its head, the copy was told what the real page would arrive with.
    expect(
      await noted(page, "/t/news", "what the copy's head was told"),
    ).toEqual({ move: "read-back", data: { tone: "warm" } });
    // And the page returned to is handed what the site said on the way out.
    expect(await noted(page, "/t/news", "arrival")).toMatchObject({
      move: "read-back",
      data: { tone: "warm" },
    });
    expect(await noted(page, "/t/article", "during")).toMatchObject({
      back: true,
      sizes: ["64px", "16px"],
      stop: link,
      behind: "iframe",
      // The page behind is without the headline the layer travels to.
      behindShows: "hidden",
    });
    expect(await noted(page, "/t/article", "stopped")).toMatchObject({
      glyphs: link,
      fontSize: "16px",
    });
    expect(await noted(page, "/t/news", "arriving")).toBe("read-back");
    await swapped(page, "#headline");
    // Put back where it was left, and marked as already seen.
    expect(
      await page.evaluate(() => ({
        scroll: scrollY,
        behind: "turnBehind" in document.documentElement.dataset,
        frames: document.querySelectorAll("iframe").length,
      })),
    ).toEqual({ scroll: 1400, behind: true, frames: 0 });
  });
});
