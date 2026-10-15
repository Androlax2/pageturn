/**
 * pageturn/sveltekit: pageturn's moves on SvelteKit's client-side navigations. Called
 * once, in the root layout, with SvelteKit's own navigation hooks, which only exist inside
 * a SvelteKit app:
 *
 *   import { beforeNavigate, onNavigate } from "$app/navigation";
 *   import { pageturn } from "pageturn/sveltekit";
 *   pageturn({ beforeNavigate, onNavigate });
 *
 * The kernel comes with it (pageturn/core), for the links SvelteKit leaves to the browser.
 * The head script goes in every page through pageturn/sveltekit/server.
 */
import "../kernel/core.ts";
import { type RouterNavigation, startNavigation } from "../router/router.ts";

/** As much of SvelteKit's navigation as the adapter reads. */
export interface SvelteKitNavigation {
  type: string;
  to: { url: URL } | null;
  willUnload: boolean;
  complete: Promise<void>;
}

export interface SvelteKitHooks {
  beforeNavigate(callback: (navigation: SvelteKitNavigation) => void): void;
  onNavigate(
    callback: (
      navigation: SvelteKitNavigation,
    ) => Promise<(() => void) | undefined> | undefined,
  ): void;
}

/** Started in beforeNavigate, taken by the onNavigate of the same navigation. */
let started: RouterNavigation | null = null;

/** Tells pageturn a navigation starts, unless it loads a page: the kernel's then. */
function begin(navigation: SvelteKitNavigation): RouterNavigation | null {
  if (!navigation.to || navigation.willUnload) return null;
  const turn = startNavigation({
    to: navigation.to.url,
    via:
      navigation.type === "link"
        ? "link"
        : navigation.type === "popstate"
          ? "history"
          : "script",
  });
  // Cancelled by another beforeNavigate, failed, or overtaken by the next navigation.
  navigation.complete.catch(() => {
    if (started === turn) started = null;
    turn.cancelled();
  });
  return turn;
}

/**
 * Plays pageturn's moves on SvelteKit's navigations. The leave starts as the navigation
 * does, while SvelteKit loads the next page's data; SvelteKit waits for it before it
 * updates the page.
 */
export function pageturn({ beforeNavigate, onNavigate }: SvelteKitHooks): void {
  beforeNavigate((navigation) => {
    started = begin(navigation);
  });
  onNavigate(async (navigation) => {
    // SvelteKit skips beforeNavigate during a redirect, and for a navigation started
    // while another one runs: it starts here then.
    const turn = started ?? begin(navigation);
    started = null;
    if (!turn) return undefined;
    await turn.left;
    // Called once the DOM is updated, before the next frame.
    return () => turn.swapped();
  });
}
