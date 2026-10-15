/**
 * pageturn/router: moves on the navigations a client router makes inside the page, with
 * no page load between the two halves. The router's adapter says when a navigation
 * starts, waits for its leave (`left`), and says when the new content is in the DOM
 * (`swapped`) or when the navigation was given up (`cancelled`). The moves, the marks and
 * the events are the same as between real pages.
 *
 * Needs the head script, which marks the first page and carries an arrival's data for
 * CSS. Inert without it, in a frame, and under reduced motion.
 */
import { warn } from "../common/dev.ts";
import { inBrowser, reducesMotion } from "../common/page.ts";
import { registry } from "../common/registry.ts";
import { readSession, writeSession } from "../common/session.ts";
import type {
  Arrival,
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
  type Report,
  returnArrival,
} from "../head/storage.ts";
import { followArrival, tellArrival } from "../kernel/arrival.ts";
import { choose, leave, turnOf } from "../kernel/turn.ts";

export interface NavigationStart {
  /** Where the router goes. */
  to: URL | string;
  /**
   * "link": a link was clicked. "script": the router was asked from code. "history":
   * Back or Forward, which plays no leave. A router that cannot tell a click from code
   * says "link": with no link clicked to `to`, it is taken as code.
   */
  via: "link" | "script" | "history";
  /** The link clicked, when the router knows it. Otherwise the last one clicked to `to`. */
  link?: HTMLAnchorElement | null;
  /**
   * The move to play, chosen by the site's code: a name, or null for none. Left out, a
   * link's move is chosen as between real pages, and a navigation from code plays the
   * default move.
   */
  move?: string | null;
}

/** One navigation, as its adapter drives it. */
export interface RouterNavigation {
  /**
   * Resolves once the page has played its leave, at once when there is none. The router
   * puts the new content in the DOM after it: never sooner. Never rejects.
   */
  readonly left: Promise<void>;
  /**
   * Says the new content is in the DOM. Called in the same task as the router's DOM
   * update, before the browser paints: the leaving mark gives way to the arriving one
   * between two frames. The router has updated the address by then: the page reached is
   * where `location` says.
   */
  swapped(): void;
  /** Says the router gave this navigation up: the page left is put back as it was. */
  cancelled(): void;
}

/** One navigation under way. */
interface Playing {
  via: NavigationStart["via"];
  to: URL;
  from: URL;
  /** The history entry left, for a return to it. */
  leftKey: string;
  /** What the page left said as it went. */
  report: Report | null;
  /** The turn playing, once a move is chosen. */
  turn?: Turn;
  /** What its leave answered: null when the page is left unmarked. */
  handover?: Handover | null;
}

const ENTRIES_KEY = "pageturn:router:entries";

/** How many history entries keep a return: a visit's recent ones. */
const KEPT_ENTRIES = 50;

/** How long a click names the link of the navigation that follows it. */
const CLICK_FRESH_MS = 1000;

const INERT: RouterNavigation = {
  left: Promise.resolve(),
  swapped() {},
  cancelled() {},
};

let current: Playing | null = null;

/** The address shown, as the engine last left or reached it: the page Back leaves. */
let shown = inBrowser ? location.href : "";

let lastClick: { link: HTMLAnchorElement; at: number } | null = null;

if (inBrowser) {
  registry.routed = true;
  addEventListener(
    "click",
    (event) => {
      const link = event
        .composedPath()
        .find((target) => target instanceof HTMLAnchorElement);
      if (link) lastClick = { link, at: Date.now() };
    },
    true,
  );
}

interface NavigationEntry {
  key: string;
  url: string | null;
  index: number;
}

/**
 * A history entry's key: the Navigation API's, where there is one; the address
 * otherwise, which tells apart every entry but two of the same page. `url` is the
 * entry's address, the current one or the one before it.
 */
function keyOf(url: URL): string {
  const api = (
    window as {
      navigation?: {
        currentEntry: NavigationEntry;
        entries(): NavigationEntry[];
      };
    }
  ).navigation;
  const here = api?.currentEntry;
  for (const entry of here ? [here, api.entries()[here.index - 1]] : []) {
    if (entry?.url && addressOf(new URL(entry.url)) === addressOf(url)) {
      return entry.key;
    }
  }
  return addressOf(url);
}

const readEntries = (): Record<string, Entry> =>
  readSession<Record<string, Entry>>(ENTRIES_KEY) ?? {};

/** Keeps how an entry was left, or forgets it with null. The oldest go first. */
function writeEntry(key: string, entry: Entry | null): void {
  const { [key]: _, ...entries } = readEntries();
  const kept = Object.entries(entries).slice(1 - KEPT_ENTRIES);
  writeSession(ENTRIES_KEY, {
    ...Object.fromEntries(kept),
    ...(entry ? { [key]: entry } : {}),
  });
}

/** What the page left says as it goes, as the kernel asks it in pagehide. */
function reportOf(from: URL): Report | null {
  const { report } = registry;
  if (!report && !window.pageturn?.arrival) return null;
  let data: Json | Declined | undefined = null;
  try {
    data = report?.({ decline: () => registry.declined }) ?? null;
  } catch (error) {
    reportError(error);
  }
  const isNone = data === registry.declined;
  return {
    from: from.pathname,
    at: Date.now(),
    data: isNone ? null : (data as Json),
    ...(isNone ? { none: true as const } : {}),
  };
}

/** The link clicked to `to` an instant ago, if any. */
function clickedTo(to: URL): HTMLAnchorElement | null {
  const click = lastClick;
  return click &&
    Date.now() - click.at < CLICK_FRESH_MS &&
    addressOf(new URL(click.link.href)) === addressOf(to)
    ? click.link
    : null;
}

/**
 * A navigation starts. Its adapter waits for `left` before the router changes the DOM,
 * then calls `swapped`, or `cancelled` if it gives the navigation up. A navigation that
 * starts while another is under way ends that one: its move's `stay` is told
 * "superseded".
 */
export function startNavigation(start: NavigationStart): RouterNavigation {
  if (!inBrowser) return INERT;
  const to = new URL(start.to, location.href);
  if (
    !window.pageturn ||
    window.top !== window ||
    reducesMotion() ||
    // The same path and query: a place in the page (#…), not another page.
    addressOf(to) === addressOf(new URL(shown))
  ) {
    shown = to.href;
    return INERT;
  }
  if (current) end(current, "superseded");
  const from = new URL(shown);
  const playing: Playing = {
    via: start.via,
    to,
    from,
    leftKey: start.via === "history" ? "" : keyOf(from),
    report: reportOf(from),
  };
  current = playing;
  const drive: RouterNavigation = {
    left: Promise.resolve(),
    swapped: () => swapped(playing),
    cancelled: () => {
      if (current === playing) end(playing, "cancelled");
    },
  };
  if (start.via === "history") return drive;

  // A router that cannot tell a click from code says "link": with no link clicked to
  // that address, it is code.
  const clicked = start.via === "link" ? (start.link ?? clickedTo(to)) : null;
  const visit: Visit = {
    link:
      clicked ?? Object.assign(document.createElement("a"), { href: to.href }),
    via: clicked ? "link" : "script",
    from,
    to,
    canHandOver: true,
  };
  const name =
    start.move !== undefined
      ? start.move
      : clicked
        ? choose(visit)
        : registry.settings.defaultMove;
  if (name === null) return drive;
  const turn = turnOf(visit, name);
  const isWanted = document.dispatchEvent(
    new CustomEvent("pageturn:leaving", { cancelable: true, detail: turn }),
  );
  if (!isWanted) return drive;
  playing.turn = turn;
  return {
    ...drive,
    left: leave(turn, (played) => {
      playing.turn = played;
    }).then((handover) => {
      if (current === playing) playing.handover = handover;
    }),
  };
}

/** The new content is in: the leaving mark gives way to the arrival, in one step. */
function swapped(playing: Playing): void {
  if (current !== playing) return;
  current = null;
  // Where the router shows it: its address can differ from the one asked for (a base
  // path, a trailing slash, a redirect). The router has updated it by now.
  const reached = new URL(location.href);
  shown = reached.href;
  const published = window.pageturn;
  if (!published) return;
  if (DEV) {
    try {
      if (document.documentElement.matches(":active-view-transition")) {
        warn(
          "transition",
          "the router plays its own view transition while pageturn plays a move: turn the router's view transitions off where pageturn plays.",
        );
      }
    } catch {
      // A browser that cannot tell has no view transitions to play.
    }
  }
  published.endArrival();
  delete document.documentElement.dataset.turnLeaving;
  let arrival: Arrival | null = null;
  if (playing.via === "history") {
    arrival = returnArrival(
      readEntries()[keyOf(reached)] ?? null,
      playing.report,
    );
  } else {
    const { turn, handover } = playing;
    if (turn && handover && handover.arriveAs !== null) {
      arrival = {
        move: handover.arriveAs ?? turn.move,
        via: "link",
        from: playing.from.pathname,
        data: (handover.data ?? null) as Json,
        remembered: null,
        reported: null,
      };
    }
    writeEntry(
      playing.leftKey,
      turn && handover?.returnAs
        ? {
            move: turn.move,
            to: reached.pathname,
            returnAs: handover.returnAs,
            remember: (handover.remember ?? null) as Json,
          }
        : null,
    );
    // Reached by a link or from code: shown anew, as a page a link reaches.
    document.documentElement.dataset.turnEntering = "";
  }
  published.arrival = arrival;
  if (arrival) published.markArrival?.(arrival);
  followArrival();
  if (arrival) tellArrival(arrival);
}

/** The navigation ends with the page left still shown: its move undoes what it changed. */
function end(playing: Playing, reason: Stay["reason"]): void {
  current = null;
  delete document.documentElement.dataset.turnLeaving;
  const { turn } = playing;
  if (!turn) return;
  const stay: Stay = { reason, handover: playing.handover ?? null };
  try {
    registry.moves.get(turn.move)?.stay?.(turn, stay);
  } catch (error) {
    reportError(error);
  }
  document.dispatchEvent(
    new CustomEvent("pageturn:stayed", { detail: { turn, stay } }),
  );
}
