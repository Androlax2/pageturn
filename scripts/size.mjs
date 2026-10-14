/**
 * Fails when a part is larger, gzipped, than its target. The targets are set from what
 * is built, a little above it: they say when a part grows, not what it should weigh.
 *
 * Files shipped as they are (the head scripts, pageturn.js, the stylesheets) are measured
 * as built. The ESM entries are measured as a site's bundler ships them: bundled with
 * their chunks and minified, which is what a page downloads. A part not built yet is skipped, and
 * said to be.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import * as esbuild from "esbuild";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));

/**
 * The kernel's chunks: those pageturn/core is made of. An entry measured without the
 * kernel leaves these out, and only these: the morph's own core is a chunk too, shared
 * with pageturn/morph/markup.
 */
const KERNEL = await readFile(`${DIST}core.js`, "utf8").then(
  (core) => new Set(core.match(/chunk-[\w-]+\.js/g)),
  () => new Set(),
);

/** Leaves the kernel's chunks out of a bundle. */
const kernelElsewhere = {
  name: "kernel-elsewhere",
  setup(build) {
    build.onResolve({ filter: /chunk-/ }, (args) =>
      KERNEL.has(args.path.split("/").pop())
        ? { path: args.path, external: true }
        : undefined,
    );
  },
};

/** Each part, its target in bytes, and how to get its bytes. */
const PARTS = [
  // Inline in every page: it carries the storage the kernel reads, the check of a page
  // loaded scrolled after every frame until the page has loaded, and what an arrival
  // carried to give back.
  ["head.js", 1550, () => readFile(`${DIST}head.js`)],
  ["head-core.js", 1450, () => readFile(`${DIST}head-core.js`)],
  // The head script and the whole kernel, with prefetch and the native hand-off.
  ["pageturn.js", 4250, () => readFile(`${DIST}pageturn.js`)],
  ["pageturn.css", 600, () => readFile(`${DIST}pageturn.css`)],
  // What a site that turns prefetch and the native hand-off off ships.
  ["pageturn/core, bundled", 2750, () => bundled("core.js")],
  ["pageturn, bundled", 3050, () => bundled("index.js")],
  // A client router's engine, beside the kernel the page has already.
  [
    "pageturn/router, beside the kernel",
    1400,
    () => bundled("router.js", true),
  ],
  // pageturn/morph as a site ships it, with only what it imports and without the kernel,
  // which the page has already. The core, then what each part adds to it.
  ["pageturn/morph, the core", 4950, () => using("defineMorph")],
  [
    "pageturn/morph, the core with here()",
    5000,
    () => using("defineMorph, here"),
  ],
  ...[
    ["seen", 250],
    ["turned", 350],
    ["copy", 200],
    ["shadow", 400],
    ["text", 1600],
    ["peek", 650],
    ["back", 1300],
    ["linkBack", 1550],
    ["back, linkBack", 1750],
    ["linkBack, behind", 2200],
  ].map(([names, target]) => [
    `  + ${names}`,
    target,
    async () => added(await using(`defineMorph, ${names}`)),
  ]),
  ["pageturn/morph, all of it", 10050, () => bundled("morph.js", true)],
  ["morph-head.js", 1350, () => readFile(`${DIST}morph-head.js`)],
  // The morph from the markup, as a bundler ships it beside a site's own morphs: what it
  // adds to the core with seen() and back().
  [
    "pageturn/morph/markup, on the core, seen and back",
    300,
    async () => {
      const base = await using("defineMorph, seen, back");
      const whole = await bundled("morph-markup.js", true);
      return { length: gzipSync(whole).length - gzipSync(base).length };
    },
  ],
  // For a site without a bundler: the morph, its head half and the markup's, whole.
  ["pageturn-morph.js", 10500, () => readFile(`${DIST}pageturn-morph.js`)],
  [
    "head-core.js with its morph half",
    2550,
    async () =>
      `${await readFile(`${DIST}head-core.js`)};${await readFile(`${DIST}morph-head.js`)}`,
  ],
];

/** An ESM entry as a bundler ships it: with its chunks, minified. */
async function bundled(entry, withoutKernel = false) {
  const { outputFiles } = await esbuild.build({
    entryPoints: [`${DIST}${entry}`],
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    // Measures an entry without the kernel it shares with the page.
    plugins: withoutKernel ? [kernelElsewhere] : [],
  });
  return outputFiles[0].contents;
}

/** pageturn/morph with these exports only, without the kernel: what tree shaking leaves. */
async function using(names) {
  const { outputFiles } = await esbuild.build({
    stdin: {
      contents: `export { ${names} } from "./morph.js";`,
      resolveDir: DIST,
    },
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    plugins: [kernelElsewhere],
  });
  return outputFiles[0].contents;
}

/** What a part adds to the core: its bundle with the core, gzipped, less the core alone. */
async function added(withPart) {
  const core = gzipSync(await using("defineMorph")).length;
  return { length: gzipSync(withPart).length - core };
}

let isOverTarget = false;
for (const [name, target, read] of PARTS) {
  let content;
  try {
    content = await read();
  } catch {
    console.log(`${name}: not built yet`);
    continue;
  }
  // A part is given as the bytes it adds, already counted.
  const size =
    typeof content === "string" || content instanceof Uint8Array
      ? gzipSync(content).length
      : content.length;
  if (size > target) isOverTarget = true;
  console.log(
    `${name}: ${size} B gzipped, target ${target} B, ${size > target ? "OVER" : "ok"}`,
  );
}
process.exit(isOverTarget ? 1 : 0);
