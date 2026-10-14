/**
 * Builds dist/:
 * - index.js, core.js, prefetch.js, native.js, morph.js, morph-markup.js, testing.js,
 *   router.js: the ESM entries, for bundlers, sharing their code through chunks so no
 *   page carries the kernel twice;
 * - astro.js: the integration;
 * - pageturn.js: head script and full kernel as one classic script, minified;
 *   pageturn-morph.js, the morph and its head half, the same way;
 * - head.js, head-core.js and head-string.js: the head script with and without its native
 *   half, and both as strings with their CSP hashes; morph-head.js, the morph's own;
 * - pageturn.css and no-native.css, from one source;
 * - Head.astro, and the declarations under types/.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import * as esbuild from "esbuild";

const dist = (name) => new URL(`../dist/${name}`, import.meta.url);
const src = (name) => new URL(`../src/${name}`, import.meta.url).pathname;
const TARGET = ["chrome111", "edge111", "firefox121", "safari16.4"];

await rm(dist(""), { recursive: true, force: true });
await mkdir(dist(""), { recursive: true });

/**
 * Internal property names, shortened in every file the same way: the head script, the
 * kernel and pageturn.js are built apart but read each other's (the head script lends
 * its storage to the kernel). One cache, filled by a first build that sees every entry,
 * keeps them agreed.
 */
const INTERNAL =
  /^(storeVersion|writeMark|forgetMark|readReport|writeReport|canStore|readEntry|writeEntry|returnArrival|store|reveal|native|moves|choosers|report|installed|declined|prefetcher|handsOver|swapNext|markArrival|notAnew)$/;
const { mangleCache } = await esbuild.build({
  bundle: true,
  entryPoints: [
    "classic/pageturn.ts",
    "classic/pageturn-morph.ts",
    "morph/index.ts",
    "morph/markup.ts",
    "morph/head.ts",
    "router/router.ts",
  ].map(src),
  outdir: "unused",
  write: false,
  define: { NATIVE: "true" },
  mangleProps: INTERNAL,
  // esbuild only answers with a cache when it is given one.
  mangleCache: {},
});
if (!mangleCache) throw new Error("No mangle cache: the builds would disagree");

const shared = {
  bundle: true,
  target: TARGET,
  legalComments: "none",
  mangleProps: INTERNAL,
  mangleCache,
};

await esbuild.build({
  ...shared,
  // Each entry of package.json's exports, by the name of its file in dist/.
  entryPoints: {
    index: src("index.ts"),
    core: src("kernel/core.ts"),
    prefetch: src("prefetch/prefetch.ts"),
    native: src("default-move/native.ts"),
    morph: src("morph/index.ts"),
    "morph-markup": src("morph/markup.ts"),
    testing: src("testing/testing.ts"),
    router: src("router/router.ts"),
  },
  format: "esm",
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  outdir: dist("").pathname,
});

// The head script's code never relies on strict mode; the prologue is bytes in every page.
const unprologued = (text) => text.replace(/^"use strict";/, "").trim();
const hashOf = (script) =>
  `sha256-${createHash("sha256").update(script).digest("base64")}`;

async function classic(entry, native, plugins = []) {
  const { outputFiles } = await esbuild.build({
    ...shared,
    entryPoints: [src(entry)],
    format: "iife",
    minify: true,
    write: false,
    define: { NATIVE: String(native) },
    plugins,
  });
  return unprologued(outputFiles[0].text);
}

const headScript = await classic("head/head.ts", true);
const coreHeadScript = await classic("head/head.ts", false);
await writeFile(dist("head.js"), headScript);
await writeFile(dist("head-core.js"), coreHeadScript);
await writeFile(
  dist("pageturn.js"),
  await classic("classic/pageturn.ts", true),
);
// The morph for a site without a bundler: in the head, after pageturn.js.
// Its imports of the core are what pageturn.js put on window.pageturn: one kernel.
const coreFromWindow = {
  name: "core-from-window",
  setup(build) {
    build.onResolve({ filter: /kernel\/core\.ts$/ }, () => ({
      path: src("classic/core-from-window.ts"),
    }));
  },
};
await writeFile(
  dist("pageturn-morph.js"),
  await classic("classic/pageturn-morph.ts", false, [coreFromWindow]),
);
// The head script's morph half, for the pages a morph's travel plays on.
const morphHeadScript = await classic("morph/head.ts", false);
await writeFile(dist("morph-head.js"), morphHeadScript);
await writeFile(
  dist("head-string.js"),
  [
    `export const headScript = ${JSON.stringify(headScript)};`,
    `export const headScriptHash = ${JSON.stringify(hashOf(headScript))};`,
    `export const coreHeadScript = ${JSON.stringify(coreHeadScript)};`,
    `export const coreHeadScriptHash = ${JSON.stringify(hashOf(coreHeadScript))};`,
    `export const morphHeadScript = ${JSON.stringify(morphHeadScript)};`,
    `export const morphHeadScriptHash = ${JSON.stringify(hashOf(morphHeadScript))};`,
    "",
  ].join("\n"),
);
await copyFile(src("head/head-string.d.ts"), dist("head-string.d.ts"));

await esbuild.build({
  entryPoints: { astro: src("astro/integration.ts") },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["astro", "astro/*", "pageturn", "pageturn/*"],
  plugins: [
    {
      // In dist/ the head script's strings sit beside the integration.
      name: "head-string-beside",
      setup(build) {
        build.onResolve({ filter: /head-string\.js$/ }, () => ({
          path: "./head-string.js",
          external: true,
        }));
      },
    },
  ],
  outdir: dist("").pathname,
});
for (const name of [
  "Head.astro",
  "head-route.js",
  "head-morph-route.js",
  "middleware.js",
  "middleware-inline.js",
  "middleware-external.js",
]) {
  await copyFile(src(`astro/${name}`), dist(name));
}

const css = await readFile(src("default-move/pageturn.css"), "utf8");
const withoutNative = css.replace(
  /\/\* native:start \*\/[\s\S]*?\/\* native:end \*\//,
  "",
);
if (withoutNative === css)
  throw new Error("pageturn.css lost its native markers");
for (const [name, source] of [
  ["pageturn.css", css],
  ["no-native.css", withoutNative],
]) {
  const { code } = await esbuild.transform(source, {
    loader: "css",
    minify: true,
    target: TARGET,
  });
  await writeFile(dist(name), code);
}

execFileSync("node_modules/.bin/tsc", ["-p", "tsconfig.build.json"], {
  stdio: "inherit",
});

// Every file package.json's exports name is there: a missing declaration ships silently.
const { exports } = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const missing = [];
for (const target of Object.values(exports)) {
  for (const file of typeof target === "string"
    ? [target]
    : Object.values(target)) {
    try {
      await readFile(new URL(`../${file}`, import.meta.url));
    } catch {
      missing.push(file);
    }
  }
}
if (missing.length > 0) {
  throw new Error(`Exported but not built: ${missing.join(", ")}`);
}
