/**
 * pageturn/nuxt: the Nuxt module. The head script first in every page's <head>, the
 * stylesheet, and a client plugin that plays pageturn's moves on Nuxt's navigations
 * (pageturn/vue on Nuxt's router):
 *
 *   // nuxt.config.ts
 *   export default defineNuxtConfig({ modules: ["pageturn/nuxt"] });
 *
 * With options: modules: [["pageturn/nuxt", { css: "no-native" }]].
 */
import { fileURLToPath } from "node:url";
import { coreHeadScript, headScript } from "../head/head-string.js";

export interface PageturnNuxtOptions {
  /**
   * Which default stylesheet to load. true: pageturn.css, with the browser's native
   * rendering of the default move where it has one. "no-native": pageturn's own in every
   * browser. false: none, the site writes its moves. Default true.
   */
  css?: boolean | "no-native";
}

/** As much of Nuxt as the module touches. */
interface Nuxt {
  options: {
    dev: boolean;
    css: string[];
    plugins: (string | { src: string; mode?: "client" | "server" | "all" })[];
    app: {
      head: {
        script?: Record<string, unknown>[];
      };
    };
  };
}

/** The module, as Nuxt calls one: with the options given in nuxt.config, and Nuxt. */
function pageturnNuxt(options: PageturnNuxtOptions = {}, nuxt: Nuxt): void {
  const { css = true } = options;
  nuxt.options.app.head.script = [
    // Before every other script: it marks the page before its first frame.
    {
      innerHTML: css === true ? headScript : coreHeadScript,
      tagPriority: "critical",
    },
    ...(nuxt.options.app.head.script ?? []),
  ];
  if (css) {
    nuxt.options.css.push(
      css === true ? "pageturn/pageturn.css" : "pageturn/no-native.css",
    );
  }
  nuxt.options.plugins.push({
    // In development, the build with the warnings (as package.json's development condition).
    src: fileURLToPath(
      new URL(
        nuxt.options.dev ? "./dev/nuxt-plugin.js" : "./nuxt-plugin.js",
        import.meta.url,
      ),
    ),
    mode: "client",
  });
}

pageturnNuxt.meta = { name: "pageturn" };

export default pageturnNuxt;
