// A React Router app using pageturn/react-router, built by Vite and served by tests/support/server.mjs
// under /react-router/fixture/build/.
import { defineConfig } from "vite";

export default defineConfig({
  base: "/react-router/fixture/build/",
  build: { outDir: "build", emptyOutDir: true },
  logLevel: "warn",
});
