/** A strict Content-Security-Policy, and what the stylesheets may animate. */
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { headScript, headScriptHash } from "../../dist/head-string.js";
import { serve } from "../support/site.ts";

const page = (name: string, head: string, link: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${name}</title>
<link rel="stylesheet" href="/dist/no-native.css">
${head}
</head><body><a id="next" href="${link}">next</a><main><h1>${name}</h1></main></body></html>`;

const violationsOf = `addEventListener("securitypolicyviolation", (event) => {
  const all = JSON.parse(sessionStorage.getItem("violations") || "[]");
  all.push(event.violatedDirective);
  sessionStorage.setItem("violations", JSON.stringify(all));
});`;

test("with script-src 'self', the external script plays the move", async ({
  page: tab,
  context,
}) => {
  await context.addInitScript(violationsOf);
  const csp = { "Content-Security-Policy": "script-src 'self'" };
  const head = `<script src="/dist/pageturn.js"></script>`;
  await serve(context, {
    a: { html: page("a", head, "/t/b"), headers: csp },
    b: { html: page("b", head, "/t/a"), headers: csp },
  });
  await tab.goto("/t/a");
  await tab.click("#next");
  await tab.waitForURL("**/t/b");
  expect(await tab.evaluate(() => window.pageturn?.arrival?.move)).toBe("page");
  expect(
    await tab.evaluate(() => sessionStorage.getItem("violations")),
  ).toBeNull();
});

test("with the hash of the inline head script, nothing is blocked", async ({
  page: tab,
  context,
}) => {
  await context.addInitScript(violationsOf);
  const csp = {
    "Content-Security-Policy": `script-src 'self' '${headScriptHash}'`,
  };
  const head = `<script>${headScript}</script><script type="module" src="/dist/index.js"></script>`;
  await serve(context, {
    a: { html: page("a", head, "/t/b"), headers: csp },
    b: { html: page("b", head, "/t/a"), headers: csp },
  });
  await tab.goto("/t/a");
  await tab.click("#next");
  await tab.waitForURL("**/t/b");
  expect(
    await tab.evaluate(() => document.documentElement.dataset.turnArriving),
  ).toBe("page");
  expect(
    await tab.evaluate(() => sessionStorage.getItem("violations")),
  ).toBeNull();
});

test("the ESM build and the classic script share one kernel", async ({
  page: tab,
  context,
}) => {
  const head = `<script src="/dist/pageturn.js"></script>
    <script type="module">
      import { defineMove, arrival } from "/dist/index.js";
      defineMove("page", { leave: () => ({ data: "from the module" }) });
      document.title = "arrival: " + JSON.stringify(arrival());
    </script>`;
  await serve(context, {
    a: { html: page("a", head, "/t/b") },
    b: { html: page("b", head, "/t/a") },
  });
  await tab.goto("/t/a");
  await expect(tab).toHaveTitle("arrival: null");
  await tab.click("#next");
  await tab.waitForURL("**/t/b");
  expect(await tab.evaluate(() => window.pageturn?.arrival?.data)).toBe(
    "from the module",
  );
});

test("the stylesheets animate transform and opacity only", async ({
  browserName,
}) => {
  test.skip(browserName !== "chromium", "reads files: once is enough");
  for (const name of ["pageturn.css", "no-native.css"]) {
    const css = await readFile(
      new URL(`../../dist/${name}`, import.meta.url),
      "utf8",
    );
    const keyframes = [
      ...css.matchAll(/@keyframes[^{]+\{((?:[^{}]*\{[^}]*\})*)\s*\}/g),
    ];
    expect(keyframes.length).toBe(2);
    for (const [, body] of keyframes) {
      const properties = [...(body ?? "").matchAll(/([a-z-]+)\s*:/g)].map(
        ([, property]) => property,
      );
      expect(properties.length).toBeGreaterThan(0);
      for (const property of properties) {
        expect(["opacity", "transform"]).toContain(property);
      }
    }
  }
});
