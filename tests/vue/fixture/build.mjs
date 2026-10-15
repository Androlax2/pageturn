/** Builds the Vue Router fixture into build/. */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const vite = fileURLToPath(
  new URL("../../../node_modules/.bin/vite", import.meta.url),
);
execFileSync(vite, ["build"], { cwd: root, stdio: "inherit" });
