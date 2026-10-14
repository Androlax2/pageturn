/**
 * pageturn/morph: one element that travels from a page to its place on the next. The
 * core is defineMorph with here() and seen(); the rest are parts, each in the bundle of a
 * site only when it imports it.
 */

export { back } from "./back.ts";
export { behind } from "./behind.ts";
export { copy } from "./copy.ts";
export { defineMorph } from "./define.ts";
export { here, seen } from "./finders.ts";
export { linkBack } from "./link-back.ts";
export { peek } from "./peek.ts";
export { shadow } from "./shadow.ts";
export { type Swap, type TextOptions, text } from "./text.ts";
export { turned } from "./turned.ts";
export type {
  About,
  Box,
  End,
  Finder,
  Kind,
  Leg,
  Morph,
  Part,
  Play,
  Timing,
} from "./types.ts";
export { forgetWayOut, wayOut } from "./way.ts";
