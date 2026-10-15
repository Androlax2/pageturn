/**
 * The development build (dist/dev/, package.json's development condition): what it warns
 * about, once, in the console. The production build says nothing.
 */
import { expect, type Page, test } from "@playwright/test";
import { serve } from "../support/site.ts";

/** The console's pageturn warnings, from now on. */
function warnings(page: Page): string[] {
  const said: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "warning" &&
      message.text().startsWith("pageturn:")
    ) {
      said.push(message.text());
    }
  });
  return said;
}

test("with no head script, it says the links navigate with no move", async ({
  page,
  context,
}) => {
  const said = warnings(page);
  await serve(context, { a: { kernel: "dev-no-head" } });
  await page.goto("/t/a");
  await expect
    .poll(() => said)
    .toEqual([expect.stringContaining("head script is not on this page")]);
});

test("under reduced motion, it says why nothing plays", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const said = warnings(page);
  await serve(context, { a: { kernel: "dev" } });
  await page.goto("/t/a");
  await expect
    .poll(() => said)
    .toEqual([expect.stringContaining("prefers-reduced-motion")]);
});

test("a client router with no adapter is named, once", async ({
  page,
  context,
}) => {
  const said = warnings(page);
  // A router as small as one: it takes the link and changes the address itself.
  const router = `<script>
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;
      event.preventDefault();
      history.pushState({}, "", link.href);
    });
  </script>`;
  await serve(context, {
    a: { kernel: "dev", head: router },
    b: { kernel: "dev" },
  });
  await page.goto("/t/a");
  await page.click("#to-b");
  await expect(page).toHaveURL(/\/t\/b$/);
  await expect
    .poll(() => said)
    .toEqual([expect.stringContaining("client router took the link")]);
  await page.click("#to-a");
  await page.waitForTimeout(500);
  expect(said).toHaveLength(1);
});

test("a page returned to under its returnAs with no animation is pointed out", async ({
  page,
  context,
}) => {
  const said = warnings(page);
  const moves = `<script type="module">
    import { defineMove } from "/dist/dev/core.js";
    defineMove("card", {
      match: ({ link }) => link.id === "to-b",
      leave: () => ({ returnAs: "card-back" }),
    });
  </script>`;
  await serve(context, {
    a: { kernel: "dev", head: moves },
    b: { kernel: "dev", head: moves },
  });
  await page.goto("/t/a");
  await page.waitForLoadState("load");
  await page.click("#to-b");
  await page.waitForURL("**/t/b");
  await page.waitForLoadState("load");
  await page.goBack();
  await page.waitForURL("**/t/a");
  await expect
    .poll(() => said)
    .toEqual([
      expect.stringContaining(
        'returned to under "card-back" with no animation',
      ),
    ]);
});

test("a router that plays its own view transition alongside pageturn is pointed out", async ({
  page,
  context,
}) => {
  const said = warnings(page);
  // A router that swaps the content inside its own view transition, and tells pageturn.
  const router = `<script type="module">
    import { startNavigation } from "/dist/dev/router.js";
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;
      event.preventDefault();
      const navigation = startNavigation({ to: link.href, via: "link", link });
      navigation.left.then(() =>
        document.startViewTransition(() => {
          history.pushState({}, "", link.href);
          document.querySelector("main h1").textContent = "b";
          navigation.swapped();
        }),
      );
    });
    window.routerReady = true;
  </script>`;
  await serve(context, {
    a: { kernel: "dev", head: router },
    b: { kernel: "dev" },
  });
  await page.goto("/t/a");
  await page.waitForFunction(() => "routerReady" in window);
  await page.click("#to-b");
  await expect
    .poll(() => said)
    .toEqual([expect.stringContaining("plays its own view transition")]);
});

test("the production build says nothing", async ({ page, context }) => {
  const said = warnings(page);
  await serve(context, { a: { kernel: "no-head" } });
  await page.goto("/t/a");
  await page.waitForTimeout(500);
  expect(said).toEqual([]);
});
