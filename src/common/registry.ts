/**
 * Moves, choosers, the whenLeft report, settings, and the parts a page may leave out
 * (pageturn/prefetch, pageturn/native). Kept on the window under a private key, so a page
 * that loads both pageturn.js and the ESM build shares one registry.
 *
 * Its field names, the store's and window.pageturn's private ones are shortened at build
 * (INTERNAL in scripts/build.mjs): never read them by name from outside the package.
 */
import type {
  Chooser,
  Declined,
  Json,
  Leaving,
  Move,
  Settings,
} from "./types.ts";

/** What pageturn/native lends the kernel. */
export interface Native {
  /**
   * Leaves the default move to the browser when it can play it: marks the page reached
   * and answers true. Answers false, and does nothing, when it cannot.
   */
  handsOver(move: string, to: URL): boolean;
  /** What the next pageswap does: null skips the browser's transition, a name adds it as a type. */
  swapNext(swap: string | null | undefined): void;
}

export interface Registry {
  moves: Map<string, Move>;
  choosers: Chooser[];
  report: ((leaving: Leaving) => Json | Declined | undefined) | null;
  settings: Required<Settings>;
  installed: boolean;
  /** pageturn/router is on the page: an adapter plays the client router's navigations. */
  routed?: boolean;
  /** What every decline() returns, the same for every copy of the kernel. */
  declined: Declined;
  prefetcher?: (to: URL) => void;
  native?: Native;
}

const KEY = Symbol.for("pageturn.registry");
const holder = globalThis as typeof globalThis & { [KEY]?: Registry };

holder[KEY] ??= {
  moves: new Map(),
  choosers: [],
  report: null,
  settings: {
    defaultMove: "page",
    prefetch: true,
    leaveTimeout: 4000,
    stuckTimeout: 4000,
    arrivalEnds: "animations",
  },
  installed: false,
  declined: Object.freeze({}) as Declined,
};

export const registry: Registry = holder[KEY];

/** A refusal: a `decline()`, or `false`, the earlier answer, still read as one. */
export const isDeclined = (answer: unknown): boolean =>
  answer === registry.declined || answer === false;
