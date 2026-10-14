/**
 * The head script's morph half: a classic script, inline in the head after pageturn's
 * own, on the pages a morph's travel can play on. It puts the layer handed over back on
 * the screen before the first frame. Without it the morph still plays, from when its
 * module has loaded.
 */
import { placeHandedLayer } from "./place.ts";

if (window.pageturnMorph === undefined)
  window.pageturnMorph = placeHandedLayer();
