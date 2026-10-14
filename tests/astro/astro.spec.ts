/** The Astro integration, in each head mode, on a built Astro site. */
import { expect, test } from "@playwright/test";
import {
  coreHeadScript,
  headScript,
  morphHeadScript,
} from "../../dist/head-string.js";
import type integration from "../../src/astro/integration.ts";

// The built integration, typed from its source.
const BUILT = "../../dist/astro.js";
const { default: pageturn } = (await import(BUILT)) as {
  default: typeof integration;
};

/** What the integration injects for these options, without building a site. */
function injected(options: Parameters<typeof pageturn>[0]) {
  const scripts: Record<string, string[]> = {};
  const plugins: {
    load?: (id: string) => string | null;
    resolveId?: (id: string) => string | null;
  }[] = [];
  const setup = pageturn(options).hooks["astro:config:setup"] as unknown as (
    api: Record<string, unknown>,
  ) => void;
  setup({
    config: { security: {} },
    injectScript: (stage: string, content: string) => {
      scripts[stage] = [...(scripts[stage] ?? []), content];
    },
    injectRoute: () => {},
    addMiddleware: () => {},
    updateConfig: (config: { vite?: { plugins?: typeof plugins } }) => {
      plugins.push(...(config.vite?.plugins ?? []));
    },
  });
  const head = plugins
    .map((plugin) => {
      const id = plugin.resolveId?.("virtual:pageturn/head");
      return id ? plugin.load?.(id) : null;
    })
    .find(Boolean);
  return { page: (scripts.page ?? []).join("\n"), head };
}

test.describe("Astro: what the options ship", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "no browser needed",
  );

  test("css: false and prefetch: false: the core alone, and the head script without its native half", () => {
    const { page, head } = injected({
      head: "manual",
      css: false,
      prefetch: false,
    });
    expect(page).toContain(`"pageturn/core"`);
    expect(page).not.toContain("pageturn/prefetch");
    expect(page).not.toContain("pageturn/native");
    expect(head).toContain("coreHeadScript as base");
  });

  test("the defaults: prefetch, native, and the full head script", () => {
    const { page, head } = injected({});
    expect(page).toContain(`import "pageturn/prefetch"`);
    expect(page).toContain(`import "pageturn/native"`);
    expect(head).toContain("{ headScript as base");
  });

  /** The head module these options make, run: which head script a page gets. */
  async function headFor(options: Parameters<typeof pageturn>[0]) {
    const source = (injected(options).head as string).replace(
      `from "pageturn/head"`,
      `from ${JSON.stringify(new URL("../../dist/head-string.js", import.meta.url).href)}`,
    );
    const module = (await import(
      `data:text/javascript,${encodeURIComponent(source)}`
    )) as { headFor(pathname: string): string };
    return module.headFor;
  }

  test("morph: true puts the morph half after the head script, in one script, on every page", async () => {
    const pick = await headFor({ head: "manual", css: false, morph: true });
    expect(pick("/")).toBe(`${coreHeadScript};${morphHeadScript}`);
    expect((await headFor({ css: false }))("/")).toBe(coreHeadScript);
  });

  test("morph: a list of paths puts the morph half on those pages only", async () => {
    const pick = await headFor({
      css: false,
      morph: ["/products/*", "/gallery"],
    });
    const morphed = `${coreHeadScript};${morphHeadScript}`;
    expect(pick("/products/chair")).toBe(morphed);
    expect(pick("/products/chair/")).toBe(morphed);
    expect(pick("/gallery/")).toBe(morphed);
    // Built as files (Astro's build.format: "file").
    expect(pick("/gallery.html")).toBe(morphed);
    expect(pick("/products/chair/index.html")).toBe(morphed);
    expect((await headFor({ css: false, morph: ["/"] }))("/index.html")).toBe(
      morphed,
    );
    expect(pick("/")).toBe(coreHeadScript);
    expect(pick("/index.html")).toBe(coreHeadScript);
    expect(pick("/gallery/one")).toBe(coreHeadScript);
    expect(pick("/about.products/x")).toBe(coreHeadScript);
  });

  test("no-native.css: prefetch, no native", () => {
    const { page, head } = injected({ css: "no-native" });
    expect(page).toContain("pageturn/prefetch");
    expect(page).not.toContain("pageturn/native");
    expect(head).toContain("coreHeadScript as base");
  });
});

for (const mode of ["inline", "external", "manual"]) {
  test.describe(`Astro, head: "${mode}"`, () => {
    const home = `/astro/dist-${mode}/`;

    test("a move defined in a page script hands its data to the next page", async ({
      page,
    }) => {
      await page.goto(home);
      await page.click("#card");
      await page.waitForURL(`**${home}about/`);
      const root = page.locator("html");
      // The page plays no animation: its arrival is over as soon as it is shown.
      await expect(root).not.toHaveAttribute("data-turn-arriving");
      const expected = {
        move: "card",
        via: "link",
        from: home,
        data: { from: "astro" },
        remembered: null,
        reported: null,
      };
      // The site's own inline script ran after the package's head script.
      expect(
        JSON.parse((await root.getAttribute("data-site-saw")) ?? ""),
      ).toEqual(expected);
      await expect(root).toHaveAttribute("data-module-saw", /card/);
      expect(
        JSON.parse((await root.getAttribute("data-module-saw")) ?? ""),
      ).toEqual(expected);
    });

    test("the head script is the one without its native half (css: no-native)", async ({
      page,
      request,
    }) => {
      await page.goto(home);
      const inline = await page.evaluate(() =>
        [...document.querySelectorAll("head script:not([src])")].map(
          (script) => script.textContent,
        ),
      );
      const external = await page.evaluate(() =>
        document
          .querySelector<HTMLScriptElement>("head script[src*=_pageturn]")
          ?.getAttribute("src"),
      );
      const shipped = external
        ? await (await request.get(external)).text()
        : inline.find((text) => text?.includes("turnArriving"));
      expect(shipped).toBe(coreHeadScript);
      expect(shipped).not.toBe(headScript);
    });

    test("the morph half is on the page `morph` names, and only there", async ({
      page,
      request,
    }) => {
      await page.goto(`${home}about/`);
      const external = await page.evaluate(() =>
        document
          .querySelector<HTMLScriptElement>("head script[src*=_pageturn]")
          ?.getAttribute("src"),
      );
      const shipped = external
        ? await (await request.get(external)).text()
        : await page.evaluate(
            () =>
              [...document.querySelectorAll("head script:not([src])")]
                .map((script) => script.textContent)
                .find((text) => text?.includes("turnArriving")) ?? null,
          );
      expect(shipped).toBe(`${coreHeadScript};${morphHeadScript}`);
      // No layer was handed over: the half ran and found nothing.
      expect(await page.evaluate(() => window.pageturnMorph)).toBeNull();
      await page.goto(home);
      expect(await page.evaluate(() => "pageturnMorph" in window)).toBe(false);
    });

    test("the default move plays on any other link", async ({ page }) => {
      await page.goto(home);
      await page.click("#to-about");
      await page.waitForURL(`**${home}about/`);
      await expect(page.locator("html")).toHaveAttribute(
        "data-turn-arriving",
        "page",
      );
    });
  });
}
