/** Generates the Nuxt fixture's pages into .output/public/. */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const nuxt = fileURLToPath(
  new URL("../../../node_modules/.bin/nuxt", import.meta.url),
);
execFileSync(nuxt, ["generate", root, "--logLevel", "warn"], {
  stdio: "inherit",
  env: { ...process.env, NUXT_TELEMETRY_DISABLED: "1" },
});
