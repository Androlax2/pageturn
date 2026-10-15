/**
 * The Astro integration: the head script on every page, the kernel as a page script,
 * the default stylesheet as a global import. It ships only the parts its options use, so
 * a site pays for nothing it turned off: pageturn/prefetch unless prefetch: false;
 * pageturn/native and the head script's native half with css: true.
 */
import { createHash } from "node:crypto";
import type { AstroIntegration } from "astro";
import type { Settings } from "../common/types.ts";
import {
  coreHeadScript,
  coreHeadScriptHash,
  headScript,
  headScriptHash,
  morphHeadScript,
} from "../head/head-string.js";

export interface PageturnOptions extends Settings {
  /**
   * Default "inline". "external": a script file, for a Content-Security-Policy without
   * inline scripts. "manual": the site renders pageturn/astro/Head.astro itself.
   */
  head?: "inline" | "external" | "manual";
  /**
   * Which default stylesheet to load. true: both renderings. "no-native": the protocol
   * in every browser. false: none, the site writes its moves. Default true.
   */
  css?: boolean | "no-native";
  /**
   * The site uses pageturn/morph: the head script gets its morph half, so a layer handed
   * over is on the first frame, and `data-turn-morph` in the markup plays. true: on every
   * page. A list: on the pages whose path matches one of them, `*` standing for anything
   * ("/products/*"); those are the pages a travel can play on, reached with no `find`
   * answer or returned to. Default false.
   */
  morph?: boolean | string[];
}

/** Where the external head script is served, under the site's base. */
const HEAD_SCRIPT_PATH = "_pageturn/head.js";
/** The same with its morph half, for the pages that have it. */
const MORPH_HEAD_SCRIPT_PATH = "_pageturn/head-morph.js";

/** Gives Head.astro, the middleware and the head route the head script these options need. */
const HEAD_MODULE = "virtual:pageturn/head";

const hashOf = (script: string): `sha256-${string}` =>
  `sha256-${createHash("sha256").update(script).digest("base64")}`;

/**
 * The module the middleware, the head routes and Head.astro read: the head script
 * without and with its morph half, and which of the two a page gets.
 */
function headModule(base: string, morph: boolean | string[]): string {
  // "/products/*" as the source of an expression: anything for `*`, the last slash or not.
  const sources = Array.isArray(morph)
    ? morph.map(
        (path) =>
          `^${path
            .replace(/\/$/, "")
            .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, ".*")}/?$`,
      )
    : null;
  return [
    `import { ${base} as base, morphHeadScript } from "pageturn/head";`,
    `const patterns = ${JSON.stringify(sources)}?.map((source) => new RegExp(source));`,
    "export const headScript = base;",
    `export const morphedHeadScript = base + ";" + morphHeadScript;`,
    "export const hasMorph = (pathname) =>",
    // A page built as a file ("/index.html", "/about.html") is the page of its path.
    `  ${Boolean(morph)} && (!patterns || patterns.some((pattern) => pattern.test(pathname.replace(/(\\/index)?\\.html$/, "") || "/")));`,
    "export const headFor = (pathname) => (hasMorph(pathname) ? morphedHeadScript : base);",
    "",
  ].join("\n");
}

export default function pageturn(
  options: PageturnOptions = {},
): AstroIntegration {
  const { head = "inline", css = true, morph = false, ...settings } = options;
  const isNative = css === true;
  // The head script these options need: with its native half or without, decided once.
  const [base, script, scriptHash] = isNative
    ? (["headScript", headScript, headScriptHash] as const)
    : (["coreHeadScript", coreHeadScript, coreHeadScriptHash] as const);
  return {
    name: "pageturn",
    hooks: {
      "astro:config:setup": ({
        config,
        injectScript,
        injectRoute,
        addMiddleware,
        updateConfig,
      }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: "pageturn:head",
                resolveId: (id) =>
                  id === HEAD_MODULE ? `\0${HEAD_MODULE}` : null,
                load: (id) =>
                  id === `\0${HEAD_MODULE}` ? headModule(base, morph) : null,
              },
            ],
          },
        });
        if (head === "external") {
          injectRoute({
            pattern: `/${HEAD_SCRIPT_PATH}`,
            entrypoint: new URL("./head-route.js", import.meta.url),
            prerender: true,
          });
          if (morph) {
            injectRoute({
              pattern: `/${MORPH_HEAD_SCRIPT_PATH}`,
              entrypoint: new URL("./head-morph-route.js", import.meta.url),
              prerender: true,
            });
          }
        }
        if (head !== "manual") {
          addMiddleware({
            entrypoint: new URL(`./middleware-${head}.js`, import.meta.url),
            order: "pre",
          });
        }
        // Astro hashes the scripts it renders; the head script is put in by the
        // middleware, so its hashes are added here. A page gets the head script with or
        // without the morph half: both hashes, unless every page has the half.
        const csp = config.security?.csp;
        if (head !== "external" && csp) {
          const current =
            csp === true ? { algorithm: "SHA-256" as const } : csp;
          const hashes = current.scriptDirective?.hashes ?? [];
          updateConfig({
            security: {
              csp: {
                ...current,
                scriptDirective: {
                  ...current.scriptDirective,
                  hashes: [
                    ...hashes,
                    ...(morph === true ? [] : [scriptHash]),
                    ...(morph ? [hashOf(`${script};${morphHeadScript}`)] : []),
                  ],
                },
              },
            },
          });
        }
        if (css) {
          const sheet = css === "no-native" ? "no-native.css" : "pageturn.css";
          injectScript("page-ssr", `import "pageturn/${sheet}";`);
        }
        const parts = [
          settings.prefetch === false ? "" : `import "pageturn/prefetch";`,
          isNative ? `import "pageturn/native";` : "",
          Object.keys(settings).length > 0
            ? `import { configure } from "pageturn/core"; configure(${JSON.stringify(settings)});`
            : `import "pageturn/core";`,
          // A morph from the markup: data-turn-morph on both elements.
          morph ? `import "pageturn/morph/markup";` : "",
        ];
        injectScript("page", parts.filter(Boolean).join("\n"));
      },
    },
  };
}
