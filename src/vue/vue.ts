/**
 * pageturn/vue: pageturn's moves on Vue Router's navigations. Called once, with the
 * router, before the app mounts:
 *
 *   import { pageturn } from "pageturn/vue";
 *   pageturn(router);
 *
 * The kernel comes with it (pageturn/core), for the links the router leaves to the
 * browser. The head script goes first in index.html's <head>. Nuxt has its own module,
 * pageturn/nuxt, built on this.
 */
import { inBrowser } from "../common/page.ts";
import "../kernel/core.ts";
import { type RouterNavigation, startNavigation } from "../router/router.ts";

/** As much of a route as the adapter reads. */
interface Route {
  matched: unknown[];
}

/** As much of Vue Router as the adapter uses. */
export interface VueRouter {
  beforeEach(guard: (to: Route, from: Route) => unknown): () => void;
  beforeResolve(guard: (to: Route, from: Route) => unknown): () => void;
  afterEach(
    hook: (to: Route, from: Route, failure?: unknown) => void,
  ): () => void;
  onError(handler: (error: unknown) => void): () => void;
  resolve(to: Route): { href: string };
  options: {
    history: {
      listen(
        callback: (to: string, from: string, info: { type: string }) => void,
      ): () => void;
    };
  };
}

export interface VueOptions {
  /**
   * Calls `swap` once the page shows the route reached. Default: in a microtask after
   * the router's afterEach, once Vue has patched the DOM. Nuxt says so at page:finish,
   * after its <Suspense> has resolved.
   */
  whenShown?: (swap: () => void) => void;
}

/**
 * Plays pageturn's moves on the router's navigations. The leave starts as the navigation
 * does, and the router waits for it once the route's components have loaded.
 */
export function pageturn(
  router: VueRouter,
  options: VueOptions = {},
): () => void {
  if (!inBrowser) return () => {};
  let current: RouterNavigation | null = null;
  let popped = false;
  const cancel = (): void => {
    current?.cancelled();
    current = null;
  };
  const stops = [
    // Back and Forward: the router's history says so before its guards run.
    router.options.history.listen((_to, _from, info) => {
      popped = info.type === "pop";
    }),
    router.beforeEach((to, from) => {
      const via = popped ? "history" : "link";
      popped = false;
      // The app's first navigation, from a route that matched nothing: no move.
      if (from.matched.length === 0) return;
      current = startNavigation({ to: router.resolve(to).href, via });
    }),
    router.beforeResolve(() => current?.left),
    router.afterEach((_to, _from, failure) => {
      const turn = current;
      current = null;
      if (!turn) return;
      if (failure) {
        turn.cancelled();
        return;
      }
      const swap = (): void => turn.swapped();
      if (options.whenShown) options.whenShown(swap);
      else queueMicrotask(swap);
    }),
    router.onError(cancel),
  ];
  return () => {
    for (const stop of stops) stop();
  };
}
