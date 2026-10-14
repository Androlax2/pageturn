/**
 * pageturn/core: the kernel and the public API, without prefetch and the native hand-off
 * (pageturn/prefetch, pageturn/native). Importing it installs the kernel, once per page.
 */

import { registry } from "../common/registry.ts";
import type {
  Arrival,
  Carries,
  Chooser,
  Declined,
  JsonOf,
  Leaving,
  Move,
  Settings,
  Visit,
} from "../common/types.ts";
import { tellArrival } from "./arrival.ts";
import { install } from "./kernel.ts";

export type {
  Arrival,
  Arrived,
  Carried,
  Carries,
  Declined,
  Handover,
  HistoryArrival,
  Json,
  JsonOf,
  Leaving,
  LinkArrival,
  Move,
  Outcome,
  Settings,
  Stay,
  Turn,
  Visit,
} from "../common/types.ts";

/**
 * Registers or replaces a move. C declares what it carries: { data, remember, report }.
 * When this page arrived under its name, its `arrive` is called once the defining code
 * has run. Returns a function that removes it.
 */
export function defineMove<C extends Carries = Carries>(
  name: string,
  move: Move<C>,
): () => void {
  const stored = move as Move;
  registry.moves.set(name, stored);
  const reached = window.pageturn?.arrival;
  if (reached?.move === name && stored.arrive) {
    queueMicrotask(() => {
      if (registry.moves.get(name) === stored) tellArrival(reached);
    });
  }
  return () => {
    if (registry.moves.get(name) === stored) registry.moves.delete(name);
  };
}

/**
 * Picks the move for a navigation: a name, null for no move (normal navigation), or
 * undefined to pass. Asked in the order they were added, after a data-turn attribute and
 * before the moves' match. Returns a function that removes it.
 */
export function chooseMove(
  chooser: (visit: Visit) => string | null | undefined,
): () => void {
  const stored: Chooser = chooser;
  registry.choosers.push(stored);
  return () => {
    const index = registry.choosers.indexOf(stored);
    if (index >= 0) registry.choosers.splice(index, 1);
  };
}

/**
 * How this page was reached, or null for a plain load. C is the declaration of the move
 * that brought it here: by a link, its data; by Back or Forward, its remember and report.
 */
export function arrival<C extends Carries = Carries>(): Arrival<C> | null {
  return (window.pageturn?.arrival ?? null) as Arrival<C> | null;
}

/**
 * Says this page's arrival is over: removes data-turn-arriving, data-turn-entering,
 * data-turn-with and the --turn-<key> properties, only if the arrival is move's when one
 * is given. arrival() keeps answering. With arrivalEnds "animations" (the default), the
 * kernel does it itself once the animations end: call this to end it sooner.
 */
export function endArrival(move?: string): void {
  window.pageturn?.endArrival(move);
}

/**
 * What this page says as it is left, by any means (a move, a plain link, Back).
 * Runs in pagehide: synchronous, no layout-heavy work. `return leaving.decline()` when
 * there is nothing to return to: a Back then arrives plain. One report per page: registering
 * again replaces the previous one. Returns a function that removes it.
 */
export function whenLeft<L>(
  report: (leaving: Leaving) => (L & JsonOf<L>) | Declined | undefined,
): () => void {
  const stored = report as () => undefined;
  registry.report = stored;
  return () => {
    if (registry.report === stored) registry.report = null;
  };
}

/** Changes the settings for this page. A setting left out keeps its value. */
export function configure(settings: Settings): void {
  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined) Object.assign(registry.settings, { [key]: value });
  }
}

install();
