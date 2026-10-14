/** The `back()` part of pageturn/morph. */
import { writeSession } from "../common/session.ts";
import type { Store } from "../head/storage.ts";
import { isLeaving } from "./define.ts";
import { markup } from "./layer.ts";
import { MORPH_KEY, onPage } from "./place.ts";
import type { Part } from "./types.ts";
import {
  type BackOptions,
  backFields,
  IN_VIEW,
  shareOnScreen,
  wayBackOf,
} from "./way.ts";

/**
 * Plays the morph backwards on the browser's Back: from the page reached, to the element
 * it left from, wherever that page is scrolled. Needs the head script's morph half on
 * the page returned to, for the layer to be on its first frame.
 */
export function back(options: BackOptions = {}): Part {
  return (stage) => {
    const way = wayBackOf(stage);
    way.byHistory = options;
    Object.assign(way.keep, options.keep);
    // The site's data is kept with the entry: a Back finds it in `arrival().remembered`.
    stage.onLeave.push((_turn, _element, _from, data) => ({
      returnAs: way.name,
      remember: data,
    }));
    // As this page is left: where its `to` element is, for a Back to the page before it.
    const said = (): void => {
      // Left by a morph: the layer that crosses is that morph's.
      if (isLeaving()) return;
      const from = way.origin();
      const element = onPage(stage.morph.to);
      const end = element && stage.read(element);
      const store = window.pageturn?.store as Store | undefined;
      const report = { from: location.pathname, at: Date.now(), data: null };
      if (
        !element ||
        !end ||
        shareOnScreen(end.box) < (options.inView ?? IN_VIEW)
      ) {
        // Nothing to bring back. If this is the page the way out led to, the page
        // returned to must not arrive by the way back: with no layer, its arrival would
        // hold the page for nothing. Said to the kernel, which then sets no mark.
        if (from && new URL(from.u).pathname === location.pathname) {
          store?.writeReport({ ...report, none: true });
        }
        return;
      }
      // The kernel says a page was left only when it was reached by a move. Reloaded
      // since, it was not: said here, so that a Back from it is still recognised.
      if (store && !store.readReport()) store.writeReport(report);
      const layer = stage.layer(element, end, null);
      writeSession(MORPH_KEY, {
        n: way.name,
        m: way.name,
        h: markup(layer),
        e: end,
        t: false,
        ...backFields(from, stage.name),
      });
    };
    addEventListener("pagehide", said);
    stage.onRemove.push(() => removeEventListener("pagehide", said));
  };
}
