/**
 * The part of pageturn/morph that runs on the page reached before its first frame: it
 * puts the layer the page left handed over back on the screen, and hides the element it
 * stands for. Shared by the head script's morph half and by pageturn/morph, which does
 * the same, later, on a page without that half.
 *
 * Nothing here relies on a style of the site's: the layer carries its own, inline.
 */

import {
  afterDomContentLoaded,
  giveFocusTo,
  notShownAnew,
} from "../common/page.ts";
import { readSession, removeSession } from "../common/session.ts";
import type { Json } from "../common/types.ts";

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** One end of a morph, measured. Plain data. */
export interface End {
  /** Where the element is drawn, in viewport pixels. */
  box: Box;
  /** Its corner radius as drawn, in pixels. */
  radius: number;
  /** Degrees it is seen turned by: read by turned() only. */
  rotate?: number;
  /** A picture's `sizes`, for the layer to ask for the same file. */
  sizes?: string;
  /** How much larger than its frame a picture is held inside it (a hover's zoom). */
  zoom?: number;
  /** How much of it shows: 0 for an end where nothing is drawn. Default 1. */
  opacity?: number;
  /** The shadow it casts, as `x y blur color`: read and drawn by shadow() only. */
  shadow?: string;
  /** A text() end: the fill of the element's own box, behind its words. */
  background?: string;
  /** A text() end: where its glyphs are, how they are set, what they say. */
  text?: {
    box: Box;
    /** Font size, weight, stretch, tracking and variation settings, as computed. */
    type: Record<string, string>;
    color: string;
    words: string;
  };
}

/** Attributes put back on a way back: selector, attribute, value (null: not there). */
export type Kept = [string, string, string | null][];

/** What crosses the page change. Short names: it is stored at every morph. */
export interface Flight {
  /** The name the page reached arrives under. */
  n: string;
  /** The morph it is for, or its way back. */
  m: string;
  /** The layer's markup, standing where it stopped. */
  h: string;
  /** The end it stopped at. */
  e: End;
  /** It has travelled: the page reached only corrects a difference. */
  t: boolean;
  /** When it has travelled: the end it started from, for the site's `ends`. */
  f?: End;
  /** What to hide on the page reached: the element the layer stands for. */
  s: string;
  /** The page reached was shown behind it as it travelled. */
  b?: boolean;
  /** A way back: the morph whose way out started at the element `s` names. */
  o?: string;
  /** That element was inside a popover that was open: it is shown again. */
  v?: boolean;
  /** The attributes linkBack()'s or back()'s `keep` recorded, set again. */
  w?: Kept;
  /**
   * The link the way out started from, found again by its address and rank among the
   * links to it, and whether it was reached by the keyboard: it is given the focus back.
   */
  l?: [string, number, boolean];
  /** Where to scroll the page reached: where it was when a link back's way out left it. */
  x?: number;
  y?: number;
}

/** A layer put back on the page reached, until a morph takes it over. */
export interface Placed {
  flight: Flight;
  layer: HTMLElement;
  sheet: CSSStyleSheet | null;
  taken: boolean;
}

declare global {
  interface Window {
    /** @internal The layer the head script put back, for pageturn/morph. */
    pageturnMorph?: Placed | null;
  }
}

export const MORPH_KEY = "pageturn:morph";

/**
 * What the selector names on the page, never in the layer: the layer's copy keeps the
 * attributes and classes of what it stands for, and is in the document too.
 */
const outsideLayer = (selector: string): string =>
  `:is(${selector}):not([data-turn-layer] *)`;

/** The page's first element the selector names, never the layer's copy of one. */
export const onPage = (selector: string): Element | null =>
  document.querySelector(outsideLayer(selector));

/** Runs as soon as the page is parsed, before its deferred scripts and modules: or now. */
export function whenParsed(run: () => void): void {
  if (document.readyState === "loading") {
    document.addEventListener("readystatechange", run, { once: true });
  } else {
    run();
  }
}

/**
 * A page returned to is put back as it was left, as soon as it is parsed: the element
 * the way out started from is marked, for the site's own scripts to find it before the
 * first frame, the attributes `keep` names are set as they were, and the popovers it sat
 * in, if they were open, are shown again. While the root carries `data-turn-restoring`,
 * until the first frames are drawn, a site switches off the transitions of what is put
 * back: it is there, it does not arrive. It is not shown anew: no `data-turn-entering`.
 *
 * Then, in the real page, the link the way out started from is given the focus back, as
 * a dialog gives it back to the button that opened it, unless the visitor has already
 * put it elsewhere: only from the body, or from inside a popover shown again here.
 */
function putBack(
  selector: string,
  name: string,
  reopens = false,
  kept: Kept = [],
  link?: [string, number, boolean],
): void {
  const root = document.documentElement;
  root.dataset.turnRestoring = "";
  notShownAnew();
  const around: HTMLElement[] = [];
  whenParsed(() => {
    let origin: Element | null = null;
    try {
      origin = selector ? onPage(selector) : null;
    } catch {}
    origin?.setAttribute("data-turn-origin", name);
    for (const [where, attribute, value] of kept) {
      try {
        const element = document.querySelector(where);
        if (value === null) element?.removeAttribute(attribute);
        else element?.setAttribute(attribute, value);
      } catch {}
    }
    for (
      let within = origin?.parentElement?.closest<HTMLElement>("[popover]");
      reopens && within;
      within = within.parentElement?.closest<HTMLElement>("[popover]")
    ) {
      around.unshift(within);
    }
    for (const popover of around) {
      try {
        popover.showPopover();
      } catch {}
    }
  });
  // Placed late (a module, a return from the cache), the event has already fired: now.
  afterDomContentLoaded(() =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (link) giveFocusBack(link, around);
        delete root.dataset.turnRestoring;
      }),
    ),
  );
}

/**
 * The link of that address, at that rank among the page's links to it: how a way out
 * names the link it started from, to find it again on the page put back.
 */
export const linkAt = (
  address: string,
  rank: number,
): HTMLAnchorElement | undefined =>
  [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].filter(
    (anchor) => anchor.href === address,
  )[rank];

/** To the link the way out started from, unless the visitor has put it elsewhere. */
function giveFocusBack(
  [address, rank, isShown]: [string, number, boolean],
  around: HTMLElement[],
): void {
  const focused = document.activeElement;
  const target = linkAt(address, rank);
  if (
    target &&
    (!focused ||
      focused === document.body ||
      around.some((popover) => popover.contains(focused)))
  ) {
    giveFocusTo(target, {
      preventScroll: true,
      focusVisible: isShown,
    } as FocusOptions);
  }
}

/** On <html>, beside the body: the body may fade, and the layer must not. */
export function showLayer(layer: HTMLElement): void {
  layer.setAttribute("aria-hidden", "true");
  // In the top layer: above any dialog, popover or menu the page has open.
  layer.setAttribute("popover", "manual");
  layer.dataset.turnLayer = "";
  document.documentElement.append(layer);
  try {
    layer.showPopover();
  } catch {}
}

/**
 * The layer handed to this page, above it, and what it stands for hidden. Null when
 * nothing was handed over, or not for the move this page arrives under.
 */
export function placeHandedLayer(): Placed | null {
  // Not in a frame: peek() and behind() load pages there, and the layer is not theirs.
  // A page shown behind is named for the scroll it was left at, and put there.
  if (window.top !== window) {
    try {
      const fromName = JSON.parse(
        window.name.split(`${MORPH_KEY}:`)[1] ?? "",
      ) as {
        x: number;
        y: number;
        m: string;
        d: Json;
        p: string;
        o: string;
        v: boolean;
        w?: Kept;
      };
      whenParsed(() => scrollTo(fromName.x, fromName.y));
      putBack(fromName.p, fromName.o, fromName.v, fromName.w);
      // What the real page will arrive with, for the copy to look the same.
      if (window.pageturn) {
        window.pageturn.behind = { move: fromName.m, data: fromName.d };
      }
    } catch {}
    return null;
  }
  const flight = readSession<Flight>(MORPH_KEY);
  removeSession(MORPH_KEY);
  if (!flight || flight.n !== window.pageturn?.arrival?.move) return null;
  const holder = document.createElement("div");
  holder.innerHTML = flight.h;
  const layer = holder.firstElementChild;
  // Markup that does not read as a layer (cut short, from another version): nothing is
  // hidden for it, and the page shows as it is.
  if (!(layer instanceof HTMLElement)) return null;
  // A rule, not a style on the element: in the head, the element is not parsed yet. No
  // selector: a way back to a page that never said which element it left from.
  let sheet: CSSStyleSheet | null = null;
  if (flight.s) {
    try {
      const rule = new CSSStyleSheet();
      rule.insertRule(`${outsideLayer(flight.s)}{visibility:hidden!important}`);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, rule];
      sheet = rule;
    } catch {}
  }
  // Set through the DOM: a Content-Security-Policy without inline styles drops the
  // style attributes of parsed markup, which is why they cross under another name.
  for (const styled of [
    layer,
    ...layer.querySelectorAll<HTMLElement>("[data-turn-style]"),
  ]) {
    styled.style.cssText = styled.dataset.turnStyle ?? "";
  }
  showLayer(layer);
  const placed: Placed = { flight, layer, sheet, taken: false };
  // Already seen behind the layer: marked, for the site to play no arrival over it.
  if (flight.b) document.documentElement.dataset.turnBehind = "";
  // Put where it was left as soon as it is parsed, before the site's scripts read the
  // scroll: by a link the page is at its top.
  const { x = 0, y } = flight;
  if (y !== undefined) whenParsed(() => scrollTo(x, y));
  if (flight.o) putBack(flight.s, flight.o, flight.v, flight.w, flight.l);
  // No morph took it over (its module is not on this page): the page shows as it is.
  // After every DOMContentLoaded listener, the markup's morphs included.
  afterDomContentLoaded(() =>
    setTimeout(() => placed.taken || clearLayer(placed)),
  );
  return placed;
}

/** Done with the layer handed over: it goes, and the element it stood for shows again. */
export function clearLayer(placed: Placed): void {
  placed.taken = true;
  document
    .querySelector("[data-turn-origin]")
    ?.removeAttribute("data-turn-origin");
  placed.layer.remove();
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
    (sheet) => sheet !== placed.sheet,
  );
}
