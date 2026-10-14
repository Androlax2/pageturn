/** Who plays the default move, the browser or the protocol. */
import { expect, test } from "@playwright/test";
import { noted, serve } from "../support/site.ts";

const REVEAL = `<script>
  addEventListener("pagereveal", (event) => note("reveal", event.viewTransition
    ? { types: [...event.viewTransition.types] }
    : null));
</script>`;

test.describe("where the browser has the native API", () => {
  test.skip(({ browserName }) => browserName === "firefox", "no native API");

  test("the default move is left to the browser, and arrival() still answers", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: { sheet: "pageturn" },
      b: { sheet: "pageturn", head: REVEAL },
    });
    await page.goto("/t/a");
    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    await page.waitForLoadState("load");
    expect(await noted(page, "/t/a", "leaving")).toBeUndefined();
    expect(await noted(page, "/t/b", "arrival")).toMatchObject({
      move: "page",
      via: "link",
    });
    await expect
      .poll(() => noted(page, "/t/b", "reveal"))
      .toEqual({ types: ["page"] });
    expect(
      await page.evaluate(() => document.documentElement.dataset.turnArriving),
    ).toBeUndefined();
  });

  test("a page reached without the native stylesheet plays the fallback arrival", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: { sheet: "pageturn" },
      b: { sheet: "no-native", head: REVEAL },
    });
    await page.goto("/t/a");
    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.dataset.turnArriving),
      )
      .toBe("page");
    await expect.poll(() => noted(page, "/t/b", "reveal")).toBeNull();
  });

  test("a custom move uses the protocol and skips the native transition", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: {
        sheet: "pageturn",
        body: `<a id="card" href="/t/b" data-turn="card">card</a>`,
      },
      b: { sheet: "pageturn", head: REVEAL },
    });
    await page.goto("/t/a");
    await page.click("#card");
    await page.waitForURL("**/t/b");
    expect(await noted(page, "/t/a", "leaving")).toBe("card");
    expect(await noted(page, "/t/b", "arriving")).toBe("card");
    await expect.poll(() => noted(page, "/t/b", "reveal")).toBeNull();
  });

  test("a default move with a leave of its own uses the protocol", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: {
        sheet: "pageturn",
        script: `pageturn.defineMove("page", { leave() {} });`,
      },
      b: { sheet: "pageturn" },
    });
    await page.goto("/t/a");
    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    expect(await noted(page, "/t/a", "leaving")).toBe("page");
    expect(await noted(page, "/t/b", "arriving")).toBe("page");
  });

  test("an opted-out link skips the native transition", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: {
        sheet: "pageturn",
        body: `<a id="out" href="/t/b" data-turn="none">b</a>`,
      },
      b: { sheet: "pageturn", head: REVEAL },
    });
    await page.goto("/t/a");
    await page.click("#out");
    await page.waitForURL("**/t/b");
    await page.waitForLoadState("load");
    await expect.poll(() => noted(page, "/t/b", "reveal")).toBeNull();
    expect(await noted(page, "/t/b", "arrival")).toBeNull();
  });

  for (const sheet of ["no-native", "none"] as const) {
    test(`with ${sheet === "none" ? "no package stylesheet" : "no-native.css"}, the protocol plays`, async ({
      page,
      context,
    }) => {
      await serve(context, { a: { sheet }, b: { sheet } });
      await page.goto("/t/a");
      await page.click("#to-b");
      await page.waitForURL("**/t/b");
      expect(await noted(page, "/t/a", "leaving")).toBe("page");
      expect(await noted(page, "/t/b", "arriving")).toBe("page");
    });
  }
});

test("without the native API, pageturn.css plays the protocol", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "firefox", "Firefox has no native API");
  await serve(context, { a: { sheet: "pageturn" }, b: { sheet: "pageturn" } });
  await page.goto("/t/a");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  expect(await noted(page, "/t/a", "leaving")).toBe("page");
  expect(await noted(page, "/t/b", "arriving")).toBe("page");
});
