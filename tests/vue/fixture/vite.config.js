// A Vue Router app using pageturn/vue, built by Vite and served by tests/support/server.mjs
// under /vue/fixture/build/.
import { defineConfig } from "vite";

export default defineConfig({
  base: "/vue/fixture/build/",
  build: { outDir: "build", emptyOutDir: true },
  logLevel: "warn",
});
