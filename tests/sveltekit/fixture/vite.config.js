// A minimal SvelteKit site using pageturn/sveltekit, prerendered by adapter-static and
// served by tests/support/server.mjs under /sveltekit/build/.
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter({ pages: "build", assets: "build" }),
      paths: { base: "/sveltekit/build" },
    }),
  ],
  logLevel: "warn",
});
