/**
 * Warnings for a site in development: why a move did not play, what is set up wrong.
 * Called under `if (DEV)` only (src/common/flags.d.ts): they are not in a production build.
 */

const said = new Set<string>();

/** Says it once per page, in the console. */
export function warn(key: string, message: string): void {
  if (said.has(key)) return;
  said.add(key);
  console.warn(`pageturn: ${message}`);
}
