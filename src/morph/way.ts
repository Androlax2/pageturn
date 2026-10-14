/**
 * What the ways back share: where a way out started, kept for the tab (`wayOut`,
 * `forgetWayOut`), and how a layer handed back lands on the element it left from.
 */
import { navigationEntry } from "../common/page.ts";
import { readSession, removeSession, writeSession } from "../common/session.ts";
import { arrival, type Json, type Visit } from "../kernel/core.ts";
import { handedOver } from "./define.ts";
import {
  type Box,
  clearLayer,
  type End,
  type Kept,
  linkAt,
  MORPH_KEY,
  type Placed,
  placeHandedLayer,
} from "./place.ts";
import type { About, Leg, Stage } from "./types.ts";

/** Where a morph's way out started: enough to find its link and its element again. */
export interface Origin {
  /** The page it started on. */
  f: string;
  /** The link's address, and its rank among the page's links to that address. */
  u: string;
  k: number;
  /** The element that travelled, as a selector from the body. */
  p: string;
  /** The scroll of the page as it was left. */
  x: number;
  y: number;
  /** The end the travel started from. */
  e: End;
  /** What the site's `data` answered as it started. */
  d: Json;
  /** The name the page it led to arrives under. */
  a: string;
  /** The element was inside a popover that was open. */
  v: boolean;
  /** The attributes `keep` names, as they were: selector, attribute, value or null. */
  w?: Kept;
  /** The link was reached by the keyboard: its focus is shown again on the way back. */
  i?: boolean;
}

const originKey = (name: string): string => `${MORPH_KEY}:from:${name}`;

/**
 * Where a morph's last way out started, or null. Forgotten on the page it led to when
 * that page is reached another way (a plain link, the address bar): the way out it
 * remembers is not how the visitor came this time. A reload and a Back keep it.
 */
function originOf(name: string): Origin | null {
  const from = readSession<Origin>(originKey(name));
  const entry = navigationEntry();
  if (
    from &&
    window.top === window &&
    new URL(from.u).pathname === location.pathname &&
    entry?.type === "navigate" &&
    window.pageturn?.arrival?.move !== from.a
  ) {
    forgetWayOut(name);
    return null;
  }
  return from;
}

/**
 * Forgets where a morph's way out started: a flow that is over, a "Close" that should
 * lead home from now on. Its way back then plays only as from a page opened directly.
 */
export function forgetWayOut(name: string): void {
  // A copy loaded in a frame (peek(), behind()) is only looked at: the visit goes on.
  if (window.top !== window) return;
  removeSession(originKey(name));
}

export interface BackOptions extends Leg {
  /** The share of the element that must show for the way back to play. Default 0.25. */
  inView?: number;
  /**
   * Attributes of the page to put back as they were when the way out started, as soon
   * as the page returned to is parsed, beside the popovers: `{ selector: attribute }`,
   * or a list of attributes. The first element the selector matches; an attribute that
   * was not there is removed. A component that keeps state of its own reads it from them.
   */
  keep?: Record<string, string | string[]>;
}

export interface LinkBackOptions extends BackOptions {
  /** Which links lead back. Default: those to the page the way out started on. */
  match?(visit: Visit): boolean;
  /** Puts the page reached where it was scrolled when it was left. Default true. */
  scroll?: boolean;
}

/** The two ends of a way back that travels before the page changes, as the site left them. */
interface Aimed {
  /** Where it stops: where the way out started. */
  stop: End;
  /** Where it starts: this page's element. */
  end: End;
}

/** What back(), linkBack() and behind() share for one morph. */
interface WayBack {
  /** The name of the way back: its move, and its CSS halves. */
  name: string;
  origin(): Origin | null;
  /** How each way of coming back plays, when its part is there. */
  byHistory?: BackOptions;
  byLink?: LinkBackOptions;
  leadsBack?(visit: Visit): boolean;
  /** behind(): the travel before the page changes. False: the site declined it. */
  aims?(from: Origin, end: End, about: About): Aimed | false;
  /** What back() and linkBack() asked to keep. */
  keep: Record<string, string | string[]>;
  /** behind(): the page reached, shown under the layer, if it comes in time. */
  frameBehind?(visit: Visit, from: Origin): Promise<HTMLIFrameElement | null>;
  /** behind(): the page stayed, and the frame it loaded goes. */
  dropFrame?(): void;
}

/** Less of the element on screen than this, and a way back would land out of sight. */
export const IN_VIEW = 0.25;

/** The share of a box that is on the screen. */
export function shareOnScreen({ left, top, width, height }: Box): number {
  const across = Math.min(left + width, innerWidth) - Math.max(left, 0);
  const down = Math.min(top + height, innerHeight) - Math.max(top, 0);
  return (Math.max(across, 0) * Math.max(down, 0)) / (width * height || 1);
}

/**
 * The element as a selector from the body, to hide it on a page loaded again. From the
 * body, not the root: a layer put back by the head script sits before the body there.
 */
function pathOf(element: Element): string {
  let path = "";
  for (
    let node = element;
    node !== document.body && node.parentElement;
    node = node.parentElement
  ) {
    const rank = [...node.parentElement.children].indexOf(node) + 1;
    path = `>${node.localName}:nth-child(${rank})${path}`;
  }
  return `body${path}`;
}

/** The element this page's address names, after its `#`. */
function elementNamedByAddress(): Element | null {
  try {
    return document.getElementById(decodeURIComponent(location.hash.slice(1)));
  } catch {
    return null;
  }
}

/**
 * The scroll a page reached by a link will have: where its address names, or where it
 * is. The page is put at the named place now, by the browser's own means, and not
 * worked out: browsers go there at a moment of their own (Firefox in two steps, a pixel
 * apart), on a pixel of their own choosing.
 */
function scrollOfAddress(): { x: number; y: number } {
  elementNamedByAddress()?.scrollIntoView({ behavior: "instant" });
  return { x: scrollX, y: scrollY };
}

/** Recorded with the way out, so that the way back shows the popover again. */
function isInAnOpenPopover(element: Element): boolean {
  try {
    return element.parentElement?.closest(":popover-open") != null;
  } catch {
    // A browser without popovers.
    return false;
  }
}

const links = (): HTMLAnchorElement[] => [
  ...document.querySelectorAll<HTMLAnchorElement>("a[href]"),
];

const waysBack = new WeakMap<Stage, WayBack>();

/** The attributes `keep` names, read on this page now. */
function readKept(keep: Record<string, string | string[]>): Kept {
  const read: Kept = [];
  for (const [selector, names] of Object.entries(keep)) {
    let element: Element | null = null;
    try {
      element = document.querySelector(selector);
    } catch {}
    if (!element) continue;
    for (const attribute of [names].flat()) {
      read.push([selector, attribute, element.getAttribute(attribute)]);
    }
  }
  return read;
}

/** A link's rank among the page's links to the same address: the inverse of `linkAt`. */
function rankOf(link: HTMLAnchorElement): number {
  const { href } = link;
  let rank = 0;
  for (const other of links()) {
    if (other === link) return rank;
    if (other.href === href) rank += 1;
  }
  return -1;
}

/**
 * What a flight back to the page a way out started on carries: the element to hide, and
 * when there was a way out, how to put the page back and which link to give the focus.
 */
export const backFields = (from: Origin | null, name: string) => ({
  s: from?.p ?? "",
  ...(from
    ? {
        ...putBackFields(from, name),
        l: [from.u, from.k, !!from.i] as [string, number, boolean],
      }
    : {}),
});

/** What a flight to the page a way out started on carries to put it back. */
export const putBackFields = (from: Origin, name: string) => ({
  o: name,
  v: from.v,
  ...(from.w?.length ? { w: from.w } : {}),
});

/** Sets a morph up to come back, once, whichever part asks first. */
export function wayBackOf(stage: Stage): WayBack {
  const known = waysBack.get(stage);
  if (known) return known;
  const key = originKey(stage.name);
  const way: WayBack = {
    name: `${stage.name}-back`,
    origin: () => originOf(stage.name),
    keep: {},
  };
  waysBack.set(stage, way);

  // Where the way out starts, kept for this tab: it survives a reload of the page
  // reached, and a walk through other pages.
  stage.onLeave.push((turn, element, from, data) => {
    writeSession(key, {
      d: data,
      a: stage.morph.arriveAs ?? stage.name,
      f: location.pathname,
      u: turn.link.href,
      k: rankOf(turn.link),
      p: pathOf(element),
      v: isInAnOpenPopover(element),
      w: readKept(way.keep),
      // A click from the keyboard leaves the link with its ring; a mouse's, without.
      i: turn.link.matches(":focus-visible"),
      x: scrollX,
      y: scrollY,
      e: from,
    } satisfies Origin);
  });

  /** Where the way out started, when it started on this page. */
  function startedHere(): Origin | null {
    const from = way.origin();
    return from?.f === location.pathname ? from : null;
  }

  /** A layer handed back to this page: to the element it left from. */
  function landBack(placed: Placed, isShown: boolean): void {
    const reached = arrival();
    const options = reached?.via === "history" ? way.byHistory : way.byLink;
    if (!reached || !options) return;
    // A page opened directly and left by a link back has none: the link is found, the
    // scroll is the address's.
    const from = startedHere();
    // The link to the page just left: the one clicked, or the first that has an element.
    const leading = links().filter((link) => link.pathname === reached.from);
    const clicked = from ? linkAt(from.u, from.k) : undefined;
    const link =
      clicked && leading.includes(clicked)
        ? clicked
        : leading.find((link) => stage.morph.from?.(link));
    if (!link) return;
    if (link !== clicked) {
      // Another element than the one hidden for the first frame.
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (sheet) => sheet !== placed.sheet,
      );
    }
    const isByLink = reached.via === "link";
    // Where the page left asked for this one to be put: done by the head script as the
    // page was parsed, when it has its morph half, and again now that it is laid out.
    const { x = 0, y } = placed.flight;
    if (y !== undefined) scrollTo(x, y);
    stage.land(
      placed,
      () => stage.morph.from?.(link) ?? null,
      stage.about(link, true),
      y !== undefined
        ? { x, y }
        : from && !isByLink && !isShown
          ? // On a Back the browser brings the scroll back itself, sometimes after this.
            { x: from.x, y: from.y }
          : isByLink
            ? scrollOfAddress()
            : { x: scrollX, y: scrollY },
      options,
    );
  }

  // After the parts have said how each way back plays.
  queueMicrotask(() => {
    const placed = handedOver();
    if (placed && !placed.taken && placed.flight.m === way.name) {
      landBack(placed, false);
    }
  });
  // Shown again by the browser's Back, from its cache: the way back plays from here.
  stage.onStay.push((stay) => {
    if (stay.reason !== "returned" || !arrival()) return;
    const placed = placeHandedLayer();
    if (placed?.flight.m === way.name) {
      landBack(placed, true);
      if (!placed.taken) clearLayer(placed);
    }
  });
  return way;
}

/**
 * Where a morph's last way out started, in this tab: the page, where it was scrolled,
 * and what the site's `data` answered then. Kept across a reload and a walk through
 * other pages, for a site whose link back depends on it (a "Close" that leads to the
 * page the visitor came from). Null when the morph has no back() or linkBack(), or has
 * not played.
 */
export function wayOut<D = Json>(
  name: string,
): { page: string; scroll: { x: number; y: number }; data: D } | null {
  const from = originOf(name);
  return (
    from && {
      page: from.f,
      scroll: { x: from.x, y: from.y },
      data: from.d as D,
    }
  );
}
