/**
 * The public types of pageturn/core, and of window.pageturn, which the head script sets
 * before any other script runs.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

/**
 * T, if it is made of JSON values; never where it is not. Unlike Json, it accepts an
 * interface (which has no implicit index signature), and undefined, which JSON drops.
 */
export type JsonOf<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends readonly (infer U)[]
    ? readonly JsonOf<U>[]
    : T extends (...args: never[]) => unknown
      ? never
      : T extends object
        ? { [K in keyof T]: JsonOf<T[K]> }
        : never;

/**
 * What a move carries, declared once:
 * - data:     what leave hands to the page reached;
 * - remember: what leave keeps with this history entry, for a return;
 * - report:   what the page reached reports through whenLeft, read on that return.
 * A field left out is Json.
 */
export interface Carries {
  data?: unknown;
  remember?: unknown;
  report?: unknown;
}

/** The declared type of one field of a Carries, or Json. */
export type Carried<C, K extends keyof Carries> = C extends {
  [P in K]?: infer V;
}
  ? unknown extends V
    ? Json
    : Exclude<V, undefined>
  : Json;

/** A navigation pageturn has accepted, before a move is chosen. */
export interface Visit {
  /**
   * The link clicked. For a navigation a client router starts from code (pageturn/router),
   * an `<a>` to the destination that is not in the page.
   */
  readonly link: HTMLAnchorElement;
  /** "link": a link was clicked. "script": a client router navigates from code. */
  readonly via: "link" | "script";
  readonly from: URL;
  readonly to: URL;
  /** False when nothing can reach the next page (no storage). */
  readonly canHandOver: boolean;
}

declare const DECLINED: unique symbol;

/** What every `decline()` returns: the turn's, a report's, a morph's `ends`'. */
export interface Declined {
  readonly [DECLINED]: true;
}

/** A visit with its move, while it plays. */
export interface Turn extends Visit {
  readonly move: string;
  /**
   * Starts the CSS half: sets data-turn-leaving to this move's name and resolves when
   * the animations and transitions that starts have ended, or at --turn-leave-max.
   * Safe to call more than once; later calls return the same promise.
   */
  leaving(): Promise<void>;
  /** The answer that declines: `return turn.decline()`. The default move plays instead. */
  decline(): Declined;
}

/** What a whenLeft report is given. */
export interface Leaving {
  /**
   * The answer that says there is nothing to return to: `return leaving.decline()`. A
   * Back to the page before this one then arrives plain, with no move.
   */
  decline(): Declined;
}

export interface Handover<C extends Carries = Carries> {
  /** Name the next page arrives under. Default: the move's name. null: no mark at all. */
  arriveAs?: string | null;
  /** For the page reached. */
  data?: JsonOf<Carried<C, "data">>;
  /** Name this page arrives under if the visitor returns to it by Back or Forward. */
  returnAs?: string;
  /** Kept with this history entry, given back on that return. */
  remember?: JsonOf<Carried<C, "remember">>;
}

/**
 * What leave may answer:
 * - nothing:          the kernel calls turn.leaving() if the move has not, waits, then
 *                     navigates.
 * - turn.decline():   declined. Nothing on the page was changed. The default move plays.
 * - a Handover:       navigate now, with this for the next page.
 * A promise of any of these is awaited. A rejection navigates with no mark.
 */
export type Outcome<C extends Carries = Carries> =
  // biome-ignore lint/suspicious/noConfusingVoidType: a leave that answers nothing is the common case.
  void | Declined | Handover<C>;

/** Reached by a link: what the move's leave handed over. */
export interface LinkArrival<C extends Carries = Carries> {
  readonly move: string;
  readonly via: "link";
  /** Pathname of the page left. */
  readonly from: string;
  readonly data: Carried<C, "data"> | null;
  readonly remembered: null;
  readonly reported: null;
}

/** Reached by Back or Forward: what this entry kept, and what the page left reported. */
export interface HistoryArrival<C extends Carries = Carries> {
  readonly move: string;
  readonly via: "history";
  /** Pathname of the page left. */
  readonly from: string;
  readonly data: null;
  /** What the move's leave kept with this entry: its `remember`. */
  readonly remembered: Carried<C, "remember"> | null;
  /** What the page left said as it went: its whenLeft report. */
  readonly reported: Carried<C, "report"> | null;
}

export type Arrival<C extends Carries = Carries> =
  | LinkArrival<C>
  | HistoryArrival<C>;

export interface Stay<C extends Carries = Carries> {
  /**
   * "stuck": the navigation never completed. "returned": shown again from bfcache; how it
   * arrives then, if its move declared returnAs, is given to that move's `arrive`.
   * With a client router (pageturn/router): "cancelled", the router gave the navigation
   * up; "superseded", another navigation started before this one was done.
   */
  readonly reason: "stuck" | "returned" | "cancelled" | "superseded";
  /** What leave answered: {} when it answered nothing, null when the page was left unmarked. */
  readonly handover: Handover<C> | null;
}

export interface Move<C extends Carries = Carries> {
  /**
   * Whether this move plays for a click no attribute and no chooser decided. Asked in
   * the order the moves were defined; the first that answers true plays.
   */
  match?(visit: Visit): boolean;
  /** On the page left: plays the way out, and says what crosses. */
  leave?(turn: Turn): Outcome<C> | Promise<Outcome<C>>;
  /**
   * On the page reached, when it arrives under this move's name, by a link or by
   * history: once the code that defines the move has run, and again each time the page is
   * shown from the back/forward cache under it.
   */
  arrive?(arrival: Arrival<C>): void;
  /**
   * On the page left, when it did not go: undo what leave changed. Called exactly once
   * per turn that did not end in a departure.
   */
  stay?(turn: Turn, stay: Stay<C>): void;
}

export interface Settings {
  /** Move used when nothing else decides. null: none. Default "page". */
  defaultMove?: string | null;
  /**
   * Ask the browser to load the destination as its link is pressed. Default true. Needs
   * pageturn/prefetch, which the full pageturn entry includes.
   */
  prefetch?: boolean;
  /** Longest a leave may take before the kernel navigates anyway, in ms. Default 4000. */
  leaveTimeout?: number;
  /** After navigating, how long before the page is declared stuck, in ms. Default 4000. */
  stuckTimeout?: number;
  /**
   * When `data-turn-arriving` and `data-turn-entering` go. "animations": once the
   * animations running on the page have ended, CSS transitions and infinite animations
   * aside. "manually": when the page calls endArrival(). Default "animations".
   */
  arrivalEnds?: "animations" | "manually";
}

/** The detail of `pageturn:arrived`, fired on the document as a page's arrival ends. */
export interface Arrived {
  /** The move it arrived by, or null for a page shown anew with no move. */
  readonly move: string | null;
  /** It was shown anew: it carried `data-turn-entering` when the arrival ended. */
  readonly entering: boolean;
  /**
   * It played to its end: its animations ended, or with arrivalEnds "manually", the page
   * ended it. False when it was cut short: by a leave, and with "animations", by
   * endArrival() or by the page removing the mark itself.
   */
  readonly whole: boolean;
}

export type Chooser = (visit: Visit) => string | null | undefined;

/** What pageturn.js adds to window.pageturn, for a site without a bundler. */
type ClassicApi = Pick<
  typeof import("../kernel/core.ts"),
  "defineMove" | "chooseMove" | "whenLeft" | "configure"
>;

/**
 * window.pageturn: set by the head script before any other script runs. `arrival` and
 * `endArrival` are always there; the rest with pageturn.js, and `morph` with
 * pageturn-morph.js.
 */
export interface PageturnGlobal extends Partial<ClassicApi> {
  /** pageturn-morph.js: the whole of pageturn/morph, as `import ... from "pageturn/morph"`. */
  morph?: typeof import("../morph/index.ts");
  arrival: Arrival | null;
  /** Ends this page's arrival: see endArrival. */
  endArrival(move?: string): void;
  /**
   * In a copy of the page shown behind a morph's way back (pageturn/morph, behind()),
   * with the head script's morph half: the move the real page will arrive by, and the
   * data it will be handed. For a page that puts itself as it will be on arrival.
   */
  behind?: { move: string; data: Json };
  /** @internal Marks the root for an arrival, with what it carries: a return from bfcache. */
  markArrival?(arrival: Arrival): void;
  /** @internal The mark of a page shown anew was taken off by the package: not an end. */
  notAnew?: true;
  /** @internal The head script's storage, for the kernel. */
  store?: unknown;
  /** @internal The head script has its native half. */
  native?: true;
  /** @internal The native transition seen at the last pagereveal. */
  reveal?: ViewTransition | null;
}

declare global {
  interface Window {
    pageturn?: PageturnGlobal;
  }
}
