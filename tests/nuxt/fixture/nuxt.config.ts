// A Nuxt app using pageturn/nuxt, generated as static pages and served by
// tests/support/server.mjs under /nuxt/fixture/.output/public/.
import { readFileSync } from "node:fs";
import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  modules: [["pageturn/nuxt", { css: "no-native" }]],
  app: {
    baseURL: "/nuxt/fixture/.output/public/",
    head: {
      style: [
        {
          innerHTML:
            "@keyframes out { to { opacity: 0 } } html[data-turn-leaving] main { animation: out 300ms both }",
        },
      ],
      script: [
        {
          innerHTML: readFileSync(
            new URL("./notes.js", import.meta.url),
            "utf8",
          ),
        },
      ],
    },
  },
  nitro: { prerender: { routes: ["/", "/b", "/c", "/d", "/real"] } },
  telemetry: false,
  devtools: { enabled: false },
  compatibilityDate: "2026-10-01",
});
