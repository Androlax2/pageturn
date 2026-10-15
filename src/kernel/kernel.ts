/**
 * The leaving half: the click filter, the lock, the phases of a turn (chosen, played,
 * left or stayed), the two timeouts and the bfcache return. Storage is the head
 * script's (window.pageturn.store); prefetch and the native hand-off are lent by
 * pageturn/prefetch and pageturn/native.
 */

import { warn } from "../common/dev.ts";
import { inBrowser, reducesMotion } from "../common/page.ts";
import { registry } from "../common/registry.ts";
import type {
  Declined,
  Handover,
  Json,
  Stay,
  Turn,
  Visit,
} from "../common/types.ts";
import {
  addressOf,
  type Entry,
  STORE_VERSION,
  type Store,
} from "../head/storage.ts";
import { followArrival, stopFollowing, tellArrival } from "./arrival.ts";
import { choose, leave, turnOf } from "./turn.ts";

/** The turn being played, from the click until the page goes or stays. */
interface Playing {
  turn: Turn;
  /** What leave answered, once the page has been left: null when left unmarked. */
  handover?: Handover | null;
  /** How it left this history entry, when it asked for a return. */
  entry?: Entry | null;
}

let store: Store;
let current: Playing | null = null;
let stuckTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Inert in an iframe, and without the head script: a page that cannot arrive is not
 * left with a move either, or the page reached would play half a move.
 */
export function install(): void {
  if (!inBrowser) return;
  const published = window.pageturn?.store as Store | undefined;
  if (registry.installed || published?.storeVersion !== STORE_VERSION) {
    // In a frame the head script is there, and leaves pageturn inert on purpose.
    if (DEV && !registry.installed && !window.pageturn) {
      warn(
        "head",
        "the head script is not on this page, so links navigate with no move. Put it first in <head>, before any other script (see the README).",
      );
    }
    return;
  }
  store = published;
  registry.installed = true;
  if (DEV && reducesMotion()) {
    warn(
      "motion",
      "prefers-reduced-motion is on: pageturn plays nothing, and links navigate as they would without it.",
    );
  }
  addEventListener("click", putClickLast, true);
  addEventListener("pointerdown", pressed, true);
  // Capture: runs before the head script's pagehide, which ends the arrival.
  addEventListener("pagehide", pageHidden, true);
  addEventListener("pageshow", pageShown);
  followArrival();
}

// Attached again at the capture of every click, so it runs after every other handler,
// including those added to window after the kernel (Turbo does the same).
function putClickLast(): void {
  // Before any handler: a router changes the address in its own.
  if (DEV) clickedAt = addressOf(location);
  removeEventListener("click", clicked);
  addEventListener("click", clicked);
}

/** The address as a click began, for the development warning about routers. */
let clickedAt = "";

function linkIn(event: Event): HTMLAnchorElement | null {
  for (const target of event.composedPath()) {
    if (target instanceof HTMLAnchorElement) {
      return target.hasAttribute("href") ? target : null;
    }
    // An SVG link has no href to read the same way: the browser's own.
    if (target instanceof SVGAElement) return null;
  }
  return null;
}

function isEditable(event: Event): boolean {
  const [target] = event.composedPath();
  return target instanceof HTMLElement && target.isContentEditable;
}

/** Where the link leads, when the kernel may handle it at all. */
function destinationOf(link: HTMLAnchorElement): URL | null {
  // A <base target> sends every link without a target of its own there too.
  const target =
    link.target ||
    document.querySelector("base[target]")?.getAttribute("target");
  if ((target && target !== "_self") || link.hasAttribute("download")) {
    return null;
  }
  const to = new URL(link.href);
  // Another site, or this very page (a `#place` in it): the browser's own. Another query
  // is another page: `?page=2`.
  const isThisPage =
    to.pathname === location.pathname && to.search === location.search;
  return to.origin === location.origin && !isThisPage ? to : null;
}

/** Asks for the page, when pageturn/prefetch is there and switched on. */
function prefetch(to: URL): void {
  if (registry.settings.prefetch) registry.prefetcher?.(to);
}

function pressed(event: PointerEvent): void {
  if (event.button !== 0 || isEditable(event)) return;
  const link = linkIn(event);
  const to = link && destinationOf(link);
  if (to) prefetch(to);
}

/**
 * A click someone else took (a client router, most often): if the address then becomes
 * the link's, a router navigated with no adapter to tell pageturn.
 */
function watchRouter(event: MouseEvent): void {
  const link = linkIn(event);
  const to = link && new URL(link.href);
  if (!to || to.origin !== location.origin || addressOf(to) === clickedAt) {
    return;
  }
  setTimeout(() => {
    if (registry.routed || addressOf(location) !== addressOf(to)) return;
    warn(
      "router",
      `a client router took the link to ${to.pathname}, so pageturn plays nothing on it. Use pageturn's adapter for that router (see the README), or pageturn/router.`,
    );
  }, 300);
}

function clicked(event: MouseEvent): void {
  if (DEV && event.defaultPrevented) watchRouter(event);
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    isEditable(event)
  ) {
    return;
  }
  const link = linkIn(event);
  const to = link && destinationOf(link);
  if (!link || !to) return;
  // A turn is playing: a second click would navigate from under it.
  if (current) {
    event.preventDefault();
    return;
  }
  // A mark left by a navigation that never completed must not follow this one.
  store.forgetMark();
  // A press already asked for it; a keyboard click has no press.
  if (event.detail === 0) prefetch(to);
  if (reducesMotion()) return;

  const { native } = registry;
  const visit: Visit = {
    link,
    via: "link",
    from: new URL(location.href),
    to,
    canHandOver: store.canStore(),
  };
  const name = choose(visit);
  if (name === null) {
    native?.swapNext(null);
    return;
  }
  const turn = turnOf(visit, name);
  const isWanted = document.dispatchEvent(
    new CustomEvent("pageturn:leaving", { cancelable: true, detail: turn }),
  );
  if (!isWanted) {
    native?.swapNext(null);
    return;
  }
  // The default move with no leave of its own may be the browser's to play: then the
  // click is not held, and pageturn/native has marked the page reached.
  if (
    name === registry.settings.defaultMove &&
    !registry.moves.get(name)?.leave &&
    native?.handsOver(name, to)
  ) {
    return;
  }

  event.preventDefault();
  const playing: Playing = { turn };
  current = playing;
  leave(turn, (played) => {
    playing.turn = played;
  }).then((handover) => depart(playing, handover));
}

function depart(playing: Playing, handover: Handover | null): void {
  if (current !== playing || playing.handover !== undefined) return;
  const { turn } = playing;
  playing.handover = handover;
  if (handover && handover.arriveAs !== null) {
    store.writeMark(
      {
        move: handover.arriveAs ?? turn.move,
        data: (handover.data ?? null) as Entry["remember"],
        from: location.pathname,
        at: Date.now(),
      },
      turn.to,
    );
  }
  playing.entry = handover?.returnAs
    ? {
        move: turn.move,
        to: turn.to.pathname,
        returnAs: handover.returnAs,
        remember: (handover.remember ?? null) as Entry["remember"],
      }
    : null;
  store.writeEntry(playing.entry);
  registry.native?.swapNext(null);
  location.assign(turn.to.href);
  // The mark is kept: a page that arrives after this still arrives by its move. It dies
  // at its own age, or at the next click (clicked).
  stuckTimer = setTimeout(
    () => endWithoutDeparture(playing, "stuck"),
    registry.settings.stuckTimeout,
  );
}

/** The turn ended without a departure: its move undoes what it changed, then the event. */
function endWithoutDeparture(playing: Playing, reason: Stay["reason"]): void {
  if (current !== playing) return;
  current = null;
  clearTimeout(stuckTimer);
  registry.native?.swapNext(undefined);
  delete document.documentElement.dataset.turnLeaving;
  const stay: Stay = { reason, handover: playing.handover ?? null };
  try {
    registry.moves.get(playing.turn.move)?.stay?.(playing.turn, stay);
  } catch (error) {
    reportError(error);
  }
  document.dispatchEvent(
    new CustomEvent("pageturn:stayed", {
      detail: { turn: playing.turn, stay },
    }),
  );
}

function pageHidden(): void {
  // A page going into bfcache must not be declared stuck while it sleeps, nor its
  // arrival said to end: the head script ends it as the page goes.
  clearTimeout(stuckTimer);
  stopFollowing();
  const { report } = registry;
  // A page reached by a move reports too, with no data, so a return to the page before
  // it can be recognised without asking every page to register a report.
  if (!report && !window.pageturn?.arrival) return;
  let data: Json | Declined | undefined = null;
  try {
    data = report?.({ decline: () => registry.declined }) ?? null;
  } catch (error) {
    reportError(error);
  }
  const isNone = data === registry.declined;
  store.writeReport({
    from: location.pathname,
    at: Date.now(),
    data: isNone ? null : (data as Json),
    ...(isNone ? { none: true as const } : {}),
  });
}

function pageShown(event: PageTransitionEvent): void {
  if (!event.persisted) return;
  registry.native?.swapNext(undefined);
  const playing = current;
  const published = window.pageturn;
  if (!published) return;
  // With a turn under way, how it left this entry; with none (shown from the cache a
  // second time), what the entry kept, as a page loaded again reads it.
  const entry = playing ? (playing.entry ?? null) : store.readEntry();
  const arrival = store.returnArrival(entry, store.readReport());
  published.arrival = arrival;
  if (arrival) {
    published.markArrival?.(arrival);
    published.reveal?.skipTransition();
    followArrival();
  }
  if (playing) endWithoutDeparture(playing, "returned");
  if (arrival) tellArrival(arrival);
}
