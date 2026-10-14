/**
 * The types of pageturn/morph: what a site writes (`Morph`, the hooks' arguments) and
 * what its parts are made of (`Kind`, `Part`, `Stage`, opaque to a site).
 */
import type {
  Declined,
  Handover,
  Json,
  Stay,
  Turn,
  Visit,
} from "../kernel/core.ts";
import type { End, Flight, Placed } from "./place.ts";

export type { Box, End } from "./place.ts";

/** What a hook is told of the travel it is asked about. */
export interface About {
  /** Playing the way back: back() and linkBack() only. */
  back: boolean;
  /** The answer of `ends` that declines: `return decline()`. The default move plays. */
  decline(): Declined;
  /**
   * The link of the page of `from`: clicked going out, found again coming back. Null on
   * the page of `to`, which does not have it.
   */
  link: HTMLAnchorElement | null;
  /**
   * Reads an element the way this morph does, as it is drawn now. With `at`: as it
   * would be drawn where that other element is, its corner (its first word, for text)
   * on the other's. For an end that is not where its element is.
   */
  measure(element: Element, at?: Element): End;
  /**
   * The scroll the page will have once the browser has put it where it goes: on a way
   * back that may not be the scroll it has yet. The ends are given for that scroll; an
   * end the site works out itself should be too.
   */
  scroll: { x: number; y: number };
}

export interface Timing {
  duration: number;
  delay: number;
  easing: string;
  fill: "both";
}

/** What `during` is given: one travel, about to start. */
export interface Play extends About {
  /**
   * The layer. The package animates its transform and its crop; the site may add to it.
   * It is cropped: what is drawn around it (a shadow) goes on an element of the site's.
   */
  layer: HTMLElement;
  /** What it shows: the picture, the copy, or the words. The site may rebuild it. */
  content: HTMLElement;
  /** text(): the box behind the words, and the words. Null for the other kinds. */
  box: HTMLElement | null;
  words: HTMLElement | null;
  /**
   * Animates an element of the page with the travel: on the travel's timing and
   * `fill: "both"`, `options` over them. Waited for as the layer's own animations are,
   * cancelled when the page stays, and on the page reached, once the layer is swapped:
   * what it ends on has to be the element's own style there.
   */
  animate(
    element: Element,
    keyframes: Keyframe[] | PropertyIndexedKeyframes,
    options?: KeyframeAnimationOptions,
  ): Animation;
  /** Where the layer starts and stops, this way. */
  start: End;
  stop: End;
  /** The travel's own timing, to give the site's animations the same clock. */
  timing: Timing;
  /** The page reached, shown behind the layer: behind() only. */
  behind: HTMLElement | null;
  /** Resolves as the travel ends, before the page changes or the layer is swapped. */
  finished: Promise<void>;
  /**
   * Reads something of the layer as it will be at the end of the travel: a width in the
   * type it grows to. The layer is put there for the time of the call, and back.
   */
  atEnd<T>(read: () => T): T;
}

/** What one direction may set apart from the other. */
export interface Leg {
  duration?: number;
  delay?: number;
  easing?: string;
}

/**
 * How the page left learns the other end. A site's own is a function of this shape;
 * `measure` reads an element the way this morph does, the page's animations over.
 */
export interface Finder {
  (
    to: URL,
    selector: string,
    measure: (element: Element) => End,
  ): End | null | Promise<End | null>;
  /** @internal What it sets up on a page that defines the morph. */
  start?: Part;
}

/** How a layer is drawn at an end. */
export interface Pose {
  /** Transform only: stays off the main thread. */
  move: Keyframe;
  /** The corners, the crop, the type: on an animation of their own. */
  look: Keyframe;
  on: HTMLElement;
  /** Something inside the layer that changes too: a picture's zoom, a text's box. */
  inner?: { look: Keyframe; on: HTMLElement };
}

/** What a layer is made of: the core's picture, copy() or text(). Opaque. */
export interface Kind {
  /**
   * @internal Adds what this kind reads of an element to its end. `isTo`: the element is
   * the one the morph lands on, not the one that travels.
   */
  read?(element: Element, end: End, isTo: boolean): void;
  /** @internal The layer for an element, to travel from one end to the other. */
  build(element: Element, from: End, to: End | null): HTMLElement;
  /** @internal How its layer is drawn at an end. */
  pose(layer: HTMLElement): (end: End) => Pose;
  /** @internal What the kind plays of its own in a travel, its animations made. */
  play?(
    layer: HTMLElement,
    start: End,
    stop: End,
    timing: Timing,
    back: boolean,
  ): void;
  /** @internal Lays a layer handed over out again, for the end it now travels to. */
  fit?(layer: HTMLElement, to: End): void;
}

/**
 * Something a site adds to a morph: turned(), shadow(), back(), linkBack(), behind().
 * Opaque.
 */
export type Part = (stage: Stage) => void;

export interface Morph<D = Json> extends Leg {
  /**
   * The element that travels, for a link of this page. Null: not this morph's link. Left
   * out on a page that only has the `to` element.
   */
  from?(link: HTMLAnchorElement): Element | null;
  /** The element it becomes, on the page reached. */
  to: string;
  /** Which clicks play it. Default: those `from` answers an element for. */
  match?(visit: Visit): boolean;
  /** How the page left learns where it lands, tried in order. Default: none. */
  find?: Finder | Finder[];
  /** What the layer is made of. Default: a picture. */
  as?: Kind;
  /**
   * The two ends, once known, before the travel is built, on the page that plays it.
   * `to` is null when no finder answered. They may be changed. `return decline()`
   * declines: the default move plays instead.
   */
  // biome-ignore lint/suspicious/noConfusingVoidType: a hook that answers nothing is the common case.
  ends?(ends: { from: End; to: End | null }, about: About): Declined | void;
  /** The site's own keyframes. Called once per travel, before its first frame. */
  during?(play: Play): void;
  /**
   * The name the page reached arrives under. Default: the morph's name. For several
   * morphs that land on one kind of page and share its arrival.
   */
  arriveAs?: string;
  /**
   * For the page reached: its `arrival().data`, as with defineMove. With back() or
   * linkBack() it is kept with the way out and given back to the page returned to.
   */
  data?(turn: Turn): D;
  /**
   * The page stayed: the navigation never completed, or the page is shown again from
   * the back/forward cache. Called after the layer is removed and the element shown
   * again, for what else the site changed as the page was left. As a move's stay.
   */
  stay?(turn: Turn, stay: Stay): void;
  /** Parts: turned(), shadow(), back(), linkBack(), behind(). */
  use?: Part[];
}

/** A layer on this page, and the element hidden for it. */
interface LiveLayer {
  layer: HTMLElement;
  hidden: HTMLElement;
}

/**
 * @internal What the parts are given: the morph's own workings. Not for a site's code;
 * it changes without notice.
 */
export interface Stage {
  name: string;
  morph: Morph;
  live: LiveLayer | null;
  /** How an element is read before the kind adds to it: turned() replaces it. */
  endOf(element: Element): End;
  /** An element as an end, as it is drawn now. */
  read(element: Element): End;
  /** The same with the animations that move it at their end. */
  atRest(element: Element): End;
  timing(leg?: Leg): Timing;
  about(link: HTMLAnchorElement | null, back: boolean): About;
  /** A layer for the element, standing at an end, not shown. */
  layer(element: Element, at: End, to: End | null): HTMLElement;
  /** A layer for the element at an end, shown in its place. */
  put(element: Element, at: End, to: End | null): Promise<HTMLElement>;
  /** The layer from one end to the other. */
  travel(
    start: End,
    stop: End,
    about: About,
    timing: Timing,
    plays?: boolean,
    behind?: HTMLElement | null,
  ): Promise<void>;
  /** Hands the layer to the page reached. */
  hand(flight: Flight): void;
  /** A layer handed to this page: brought to the real element, then swapped for it. */
  land(
    placed: Placed,
    target: () => Element | null,
    about: About,
    scroll?: { x: number; y: number },
    leg?: Leg,
  ): Promise<void>;
  /** Removes the layer and shows the element again. */
  drop(): void;
  /** Called as the way out leaves: what each answers is added to the handover. */
  onLeave: ((
    turn: Turn,
    element: Element,
    from: End,
    data: Json,
    // biome-ignore lint/suspicious/noConfusingVoidType: most add nothing.
  ) => Handover | void)[];
  /** Called for each travel, its animations made, before the site's `during`. */
  onPlay: ((
    layer: HTMLElement,
    start: End,
    stop: End,
    timing: Timing,
    finished: Promise<void>,
  ) => void)[];
  /** Called when a page that was being left is shown again. */
  onStay: ((stay: Stay) => void)[];
  /** Called when the morph is removed. */
  onRemove: (() => void)[];
  /** What the site's `during` animated with `animate`: cancelled as the layer is dropped. */
  siteAnimations: Animation[];
  /** behind(): how the page behind comes in, when not on the travel's timing. */
  appear?: Leg | undefined;
}
