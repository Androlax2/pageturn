/**
 * Where there is no browser: a framework renders its layouts on the server, and imports
 * pageturn there. Every module entry loads, and the API answers, doing nothing.
 */
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

/** The module entries of package.json's exports, as built files. */
async function moduleEntries(): Promise<string[]> {
  const { exports } = JSON.parse(await readFile("package.json", "utf8")) as {
    exports: Record<string, string | { default: string }>;
  };
  return Object.values(exports)
    .map((target) => (typeof target === "string" ? target : target.default))
    .filter(
      (file) =>
        file.endsWith(".js") &&
        !/\/(pageturn|pageturn-morph|morph-head)\.js$/.test(file),
    )
    .map((file) => file.replace(/^\.\//, "../../"));
}

test("every module entry imports where there is no document", async ({
  browserName,
}) => {
  // Once: this runs in the test process, not in a browser.
  test.skip(browserName !== "chromium");
  expect(typeof document).toBe("undefined");
  const files = await moduleEntries();
  expect(files.length).toBeGreaterThan(8);
  for (const file of files) {
    await expect(import(file), file).resolves.toBeDefined();
  }
});

test("the API is safe to call on the server, and does nothing there", async ({
  browserName,
}) => {
  test.skip(browserName !== "chromium");
  // The built files, typed from their sources.
  const built = (name: string) => `../../dist/${name}.js`;
  const core = (await import(
    built("core")
  )) as typeof import("../../src/kernel/core.ts");
  const remove = core.defineMove("server", { arrive: () => {} });
  expect(core.arrival()).toBeNull();
  core.endArrival();
  remove();
  const { defineMorph } = (await import(
    built("morph")
  )) as typeof import("../../src/morph/index.ts");
  defineMorph("server", { from: () => null, to: "#nothing" })();
  const { startNavigation } = (await import(
    built("router")
  )) as typeof import("../../src/router/router.ts");
  const navigation = startNavigation({
    to: "https://example.com/",
    via: "link",
  });
  await expect(navigation.left).resolves.toBeUndefined();
  navigation.swapped();
});
