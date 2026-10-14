/** The entries a page loads, and what each brings: the head script, the kernel, its parts. */
import { expect, test } from "@playwright/test";
import { isHandled, noted, serve } from "../support/site.ts";

test.describe("the entries a page loads", () => {
  test("pageturn/core plays moves and hands data over, with the head script without its native half", async ({
    page,
    context,
  }) => {
    const define = `<script type="module">
      import { defineMove } from "/dist/core.js";
      defineMove("card", { match: ({ link }) => link.id === "to-b",
        leave: (turn) => turn.leaving().then(() => ({ data: { from: "core" } })) });
      window.ready = true;
    </script>`;
    await serve(context, {
      a: { kernel: "core", head: define },
      b: { kernel: "core" },
    });
    await page.goto("/t/a");
    await page.waitForFunction(() => "ready" in window);
    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    expect(await noted(page, "/t/a", "leaving")).toBe("card");
    expect(await noted(page, "/t/b", "arrival")).toMatchObject({
      move: "card",
      data: { from: "core" },
    });
  });

  test("pageturn/core asks for nothing on a press; the full entry does", async ({
    page,
    context,
  }) => {
    const site = await serve(context, {
      core: { kernel: "core" },
      full: { kernel: "full" },
      b: {},
    });
    const press = () =>
      page.evaluate(() =>
        document
          .getElementById("to-b")
          ?.dispatchEvent(
            new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
          ),
      );
    const asked = () =>
      page.evaluate(
        () => document.querySelectorAll('link[rel="prefetch"]').length,
      );
    await page.goto("/t/core");
    await page.waitForFunction(() => document.readyState === "complete");
    await press();
    await page.waitForTimeout(300);
    expect(await asked()).toBe(0);
    expect(site.requests.get("b")).toBeUndefined();

    await page.goto("/t/full");
    await page.waitForFunction(() => document.readyState === "complete");
    await press();
    const usesLink = await page.evaluate(() =>
      document.createElement("link").relList.supports("prefetch"),
    );
    if (usesLink) await expect.poll(asked).toBe(1);
    else await expect.poll(() => site.requests.get("b")).toBe(1);
  });

  test("without its head script, the kernel is inert", async ({
    page,
    context,
  }) => {
    await serve(context, {
      a: { kernel: "no-head" },
      b: { kernel: "no-head" },
    });
    await page.goto("/t/a");
    await page.waitForFunction(() => document.readyState === "complete");
    expect(await isHandled(page, "#to-b")).toBe(false);
    await page.click("#to-b");
    await page.waitForURL("**/t/b");
    expect(await noted(page, "/t/a", "leaving")).toBeUndefined();
  });

  test.describe("where the browser has the native API", () => {
    test.skip(({ browserName }) => browserName === "firefox", "no native API");

    test("the full ESM entry with pageturn.css leaves the default move to the browser", async ({
      page,
      context,
    }) => {
      await serve(context, {
        a: { kernel: "full", sheet: "pageturn" },
        b: { kernel: "full", sheet: "pageturn" },
      });
      await page.goto("/t/a");
      await page.waitForFunction(() => document.readyState === "complete");
      await page.click("#to-b");
      await page.waitForURL("**/t/b");
      await page.waitForLoadState("load");
      expect(await noted(page, "/t/a", "leaving")).toBeUndefined();
      expect(await noted(page, "/t/b", "arrival")).toMatchObject({
        move: "page",
      });
    });

    for (const [what, kernel, head] of [
      ["pageturn/core", "core", ""],
      [
        "pageturn/native with a head script that lacks its native half",
        "core",
        `<script type="module" src="/dist/native.js"></script>`,
      ],
    ] as const) {
      test(`${what} plays the protocol, even with pageturn.css`, async ({
        page,
        context,
      }) => {
        await serve(context, {
          a: { kernel, head, sheet: "pageturn" },
          b: { kernel, sheet: "pageturn" },
        });
        await page.goto("/t/a");
        await page.waitForFunction(() => document.readyState === "complete");
        await page.click("#to-b");
        await page.waitForURL("**/t/b");
        expect(await noted(page, "/t/a", "leaving")).toBe("page");
        expect(await noted(page, "/t/b", "arriving")).toBe("page");
      });
    }
  });
});
