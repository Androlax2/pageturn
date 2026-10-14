// Written by scripts/build.mjs next to astro.js; declared here so the source type-checks.

/** The head script with its native half: for pages loading pageturn.css. */
export declare const headScript: string;
export declare const headScriptHash: `sha256-${string}`;
/** The head script without it: for pages that never let the browser play a move. */
export declare const coreHeadScript: string;
export declare const coreHeadScriptHash: `sha256-${string}`;
/** The morph's own head script, placed after either of the two above (pageturn/morph). */
export declare const morphHeadScript: string;
export declare const morphHeadScriptHash: `sha256-${string}`;
