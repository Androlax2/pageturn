/**
 * The arriving half. Runs in the head, before the first frame, as a classic script: it
 * works out how the page was reached, publishes it on window.pageturn and marks <html>.
 * Self-contained by construction: the build inlines what it imports.
 *
 * Built twice: with its native half (NATIVE true), for pages that may let the browser
 * play the default move, and without it, for the others, which then do not carry it.
 */

import {
  navigationEntry,
  notShownAnew,
  reducesMotion,
} from "../common/page.ts";
import type { Arrival, PageturnGlobal } from "../common/types.ts";
import {
  addressOf,
  readEntry,
  readReport,
  returnArrival,
  store,
  takeMark,
} from "./storage.ts";

declare const NATIVE: boolean;

const root = document.documentElement;

const CARRIED_PREFIX = "--turn-";

/**
 * Each property the arrival set on the root, with the value it covered and its own. At
 * the end, only a property still at the arrival's value is given back: the site's own
 * `--turn-*` settings stay, also those it wrote over the arrival's meanwhile.
 */
const carried = new Map<string, { covered: string; own: string }>();

function endArrival(move?: string): void {
  if (!move || root.dataset.turnArriving === move) {
    delete root.dataset.turnArriving;
    // And what came with it: the page shown anew, and what the arrival carried for its CSS.
    delete root.dataset.turnEntering;
    delete root.dataset.turnWith;
    for (const [property, { covered, own }] of carried) {
      if (root.style.getPropertyValue(property) !== own) continue;
      if (covered) root.style.setProperty(property, covered);
      else root.style.removeProperty(property);
    }
    carried.clear();
  }
}

/**
 * What crossed, for the arriving half to read in CSS: each string or number at the top of
 * it is `--turn-<key>` on the root, and each key that is `true` a word of
 * `data-turn-with`, for the time of the arrival.
 */
function carry(data: unknown): void {
  if (typeof data !== "object") return;
  for (const [key, value] of Object.entries(data ?? {})) {
    if (/^(string|number)$/.test(typeof value)) {
      const property = CARRIED_PREFIX + key;
      const own = `${value}`;
      carried.set(property, {
        covered:
          carried.get(property)?.covered ??
          root.style.getPropertyValue(property),
        own,
      });
      root.style.setProperty(property, own);
    } else if (value === true) {
      root.dataset.turnWith = `${root.dataset.turnWith ?? ""} ${key}`.trim();
    }
  }
}

/** What an arrival carries for CSS: by a link its data; by Back what the entry kept, then what the page left reported. */
function carryAll(arrival: Arrival): void {
  carry(arrival.remembered);
  carry(arrival.reported);
  carry(arrival.data);
}

/** Marks the root for an arrival, with what it carries. */
function markArrival(arrival: Arrival): void {
  root.dataset.turnArriving = arrival.move;
  carryAll(arrival);
}

/** Works out the arrival. Inert in an iframe, where marks are left for the top page. */
function start(): void {
  const published: PageturnGlobal = {
    arrival: null,
    endArrival,
    markArrival: markArrival,
  };
  window.pageturn = published;
  if (window.top !== window) return;
  published.store = store;
  if (NATIVE) published.native = true;

  // Taken even when nothing plays: left in storage, it would follow a later page.
  const taken = takeMark();
  if (reducesMotion()) return;
  const navigation = navigationEntry();
  // Only on the page it was left for, reached by that click: not on a reload, a Back, or
  // another page opened in the 10 s it lives. A redirect (`/about` to `/about/`) changes
  // the address on the way, and still counts.
  const mark =
    taken &&
    navigation?.type !== "reload" &&
    navigation?.type !== "back_forward" &&
    (!taken.to ||
      taken.to === addressOf(location) ||
      (navigation?.redirectCount ?? 0) > 0)
      ? taken
      : null;
  published.arrival = mark
    ? {
        move: mark.move,
        via: "link",
        from: mark.from,
        data: mark.data ?? null,
        remembered: null,
        reported: null,
      }
    : navigation?.type === "back_forward"
      ? returnArrival(readEntry(), readReport())
      : null;
  // Only a default move the browser may be playing waits for pagereveal to know.
  let waitsForReveal =
    NATIVE && Boolean(mark?.native && "CSSViewTransitionRule" in window);
  const { arrival } = published;
  if (arrival) {
    // The mark waits for pagereveal, which says whether the browser plays the move.
    if (waitsForReveal) carryAll(arrival);
    else markArrival(arrival);
  }
  // Shown anew: not brought back by history, and not loaded already scrolled (a reload,
  // a link to a place in it). The browser puts that scroll back after the head has run,
  // as late as the page's load, in a layout that may change nothing else, and sends its
  // scroll event a frame later or not at all. So the scroll is looked at after each
  // frame's layout, before it is painted. A scroll that follows the visitor's own wheel,
  // touch, key or press is theirs, and so is one after the page has loaded.
  if (navigation?.type !== "back_forward") {
    root.dataset.turnEntering = "";
    const INPUTS = ["wheel", "touchstart", "keydown", "pointerdown"];
    let isWatching = true;
    const scrolled = (): void => {
      if (isWatching && (scrollX || scrollY)) {
        notShownAnew();
        stop();
      }
    };
    // Observed again each frame: a target observed anew reports after the next layout,
    // whatever changed. One observer for all of them.
    const laidOut = new ResizeObserver(scrolled);
    const stop = (): void => {
      isWatching = false;
      laidOut.disconnect();
      removeEventListener("scroll", scrolled);
      for (const input of INPUTS) removeEventListener(input, stop, true);
    };
    const eachFrame = (): void => {
      if (!isWatching) return;
      laidOut.observe(root);
      requestAnimationFrame(eachFrame);
    };
    eachFrame();
    addEventListener("scroll", scrolled);
    for (const input of INPUTS) addEventListener(input, stop, true);
    addEventListener("load", () =>
      requestAnimationFrame(() => requestAnimationFrame(stop)),
    );
  }

  if (NATIVE) {
    addEventListener("pagehide", (event) => {
      if (!event.persisted) return;
      published.reveal = null;
      waitsForReveal = false;
    });
    addEventListener("pagereveal", (event) => {
      const transition = event.viewTransition;
      published.reveal = transition;
      const { arrival } = published;
      if (!arrival) return;
      // A move the package plays: the browser's transition, if any, must not play too.
      if (!waitsForReveal) transition?.skipTransition();
      // The browser plays the default move: its type names it, for the native CSS.
      else if (transition) transition.types.add(arrival.move);
      // It turned out not to: the package plays it.
      else root.dataset.turnArriving = arrival.move;
      waitsForReveal = false;
    });
  }

  // Entering the back/forward cache ends the arrival: back, the page is either plain or
  // arrives anew under its move's returnAs, never under the arrival it had first.
  addEventListener("pagehide", (event) => {
    if (!event.persisted) return;
    published.arrival = null;
    endArrival();
  });
}

if (!window.pageturn) start();
