/**
 * pageturn/native: lets the browser play the default move where it has cross-document
 * view transitions, and keeps its transition from playing over a move of the package's.
 * Imported for its effect; the full pageturn entry includes it.
 *
 * The default move goes native only when three things agree: the browser has the API,
 * the loaded stylesheet carries the native rendering (its marker), and the head script
 * has its native half, which plays the other side of the hand-off.
 */

import { registry } from "../common/registry.ts";
import type { Store } from "../head/storage.ts";

let nextSwap: string | null | undefined;

if (!registry.native) {
  // The page left says, as it goes, whether the browser's transition plays: skipped
  // under a move of the package's, named by its type for the default move's native CSS.
  addEventListener("pageswap", (event) => {
    const transition = event.viewTransition;
    if (nextSwap === null) transition?.skipTransition();
    else if (nextSwap) transition?.types.add(nextSwap);
    nextSwap = undefined;
  });
  registry.native = {
    handsOver(move, to) {
      const store = window.pageturn?.store as Store | undefined;
      const plays =
        store &&
        window.pageturn?.native &&
        "CSSViewTransitionRule" in window &&
        getComputedStyle(document.documentElement)
          .getPropertyValue("--pageturn-native")
          .trim() !== "";
      if (!plays) return false;
      store.writeMark(
        {
          move,
          data: null,
          from: location.pathname,
          at: Date.now(),
          native: true,
        },
        to,
      );
      // The browser plays this move and its Back: the package keeps no return for it.
      store.writeEntry(null);
      nextSwap = move;
      return true;
    },
    swapNext: (value) => {
      nextSwap = value;
    },
  };
}
