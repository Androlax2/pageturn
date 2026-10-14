/**
 * Entry of pageturn-morph.js, for sites without a bundler: in the head, after
 * pageturn.js. The head script's morph half (the layer back on the first frame), the
 * morph from the markup, and the whole of pageturn/morph on window.pageturn.morph.
 */
import "../morph/head.ts";
import "../morph/markup.ts";
import * as morph from "../morph/index.ts";

if (window.pageturn) window.pageturn.morph = morph;
