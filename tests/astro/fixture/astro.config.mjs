// A minimal Astro site using the integration, built once per head mode:
//   PAGETURN_HEAD=external astro build --root tests/astro/fixture
import { defineConfig } from "astro/config";
import pageturn from "pageturn/astro";

const head = process.env.PAGETURN_HEAD ?? "inline";

export default defineConfig({
  // Served by tests/support/server.mjs under /astro/, so the base is the folder's path.
  base: `/astro/dist-${head}`,
  outDir: `./dist-${head}`,
  trailingSlash: "always",
  // The morph half on the about page only: the home page must ship without it.
  integrations: [pageturn({ head, css: "no-native", morph: ["*/about"] })],
  vite: { define: { "import.meta.env.PAGETURN_HEAD": JSON.stringify(head) } },
});
