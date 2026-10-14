/** Builds the Astro fixture once per head mode, into dist-<mode>/. */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
for (const mode of ["inline", "external", "manual"]) {
  execFileSync(
    "node_modules/.bin/astro",
    ["build", "--root", root, "--silent"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        PAGETURN_HEAD: mode,
        ASTRO_TELEMETRY_DISABLED: "1",
      },
    },
  );
}
