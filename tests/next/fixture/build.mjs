/** Exports the Next.js fixture as static pages into out/. */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const next = fileURLToPath(
  new URL("../../../node_modules/.bin/next", import.meta.url),
);
execFileSync(next, ["build", root], {
  stdio: "inherit",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
});
