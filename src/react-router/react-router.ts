/**
 * pageturn/react-router: pageturn's moves on React Router's navigations (data routers:
 * createBrowserRouter, or framework mode). Two pieces: a middleware on the root route,
 * which starts the leave and holds the navigation until it has ended, and a hook in the
 * root layout, which says when the route reached is in the DOM.
 *
 *   import { pageturnMiddleware, usePageturn } from "pageturn/react-router";
 *   const router = createBrowserRouter([
 *     { path: "/", Component: Root, middleware: [pageturnMiddleware], children },
 *   ]);
 *   function Root() { usePageturn(); return <Outlet />; }
 *
 * The kernel comes with it (pageturn/core), for the links the router leaves to the
 * browser. The head script goes first in the document's <head>.
 */
import { useLayoutEffect } from "react";
import { type MiddlewareFunction, useLocation } from "react-router";
import { inBrowser } from "../common/page.ts";
import "../kernel/core.ts";
import { type RouterNavigation, startNavigation } from "../router/router.ts";

/** The navigation the middleware started, until the root layout shows its route. */
let current: RouterNavigation | null = null;

/** Back or Forward: the browser's popstate comes before the router's navigation. */
let popped = false;

/** The root layout has mounted: before it, the router is loading the first page. */
let isMounted = false;

if (inBrowser) {
  // Capture, on window: before the router's own popstate listener there.
  addEventListener(
    "popstate",
    () => {
      popped = true;
    },
    true,
  );
}

/**
 * On the root route: starts pageturn's navigation as the router's starts, runs the
 * route's loaders meanwhile, and lets the router commit once both are done.
 */
export const pageturnMiddleware: MiddlewareFunction = async (
  { request },
  next,
) => {
  const via = popped ? "history" : "link";
  popped = false;
  if (!isMounted) return next();
  const turn = startNavigation({ to: request.url, via });
  current = turn;
  // The router aborts a navigation as the next one starts, before that one reaches this
  // middleware: a task later, the next has said so ("superseded"); otherwise it is over.
  request.signal.addEventListener("abort", () => {
    setTimeout(() => {
      if (current !== turn) return;
      current = null;
      turn.cancelled();
    });
  });
  const [result] = await Promise.all([next(), turn.left]);
  return result;
};

/**
 * In the root layout: tells pageturn the route reached is in the DOM, from a layout
 * effect, before the browser paints it.
 */
export function usePageturn(): void {
  const { key } = useLocation();
  useLayoutEffect(() => {
    isMounted = true;
  }, []);
  // Once for each location reached.
  useLayoutEffect(() => {
    const turn = current;
    current = null;
    turn?.swapped();
  }, [key]);
}
