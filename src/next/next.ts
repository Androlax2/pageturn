"use client";
/**
 * pageturn/next: pageturn's moves on Next.js's App Router. The router cannot wait for a
 * leave, so the adapter stops its navigation, plays the leave, then asks the router again:
 *
 *   import { Link, Pageturn, useTurnRouter } from "pageturn/next";
 *   // app/layout: <body><Pageturn />{children}</body>
 *   // links: <Link href="/work">Work</Link>, as next/link
 *   // from code: const router = useTurnRouter(); router.push("/work");
 *
 * A plain next/link, a bare router.push, Back and Forward still work: the page arrives,
 * with no leave. The kernel comes with it (pageturn/core), for the links Next leaves to
 * the browser. The head script goes first in the root layout's <head>, from pageturn/head.
 */
// With their file names: Next has no exports map, and Node's own loader needs them.
import NextLink from "next/link.js";
import { usePathname, useRouter, useSearchParams } from "next/navigation.js";
import {
  type ComponentProps,
  createElement,
  type Ref,
  Suspense,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { inBrowser } from "../common/page.ts";
import "../kernel/core.ts";
import { type RouterNavigation, startNavigation } from "../router/router.ts";

type Router = ReturnType<typeof useRouter>;
type NavigateOptions = Parameters<Router["push"]>[1];

/** The navigation pageturn started, until <Pageturn /> sees the page it leads to. */
let pending: RouterNavigation | null = null;

/** The address <Pageturn /> last saw shown: null before it first renders. */
let shownAt: string | null = null;

/**
 * Starts the leave, then the router's navigation once the leave has ended. A link gives
 * its anchor: the address it leads to, with the base path the router adds to `href`.
 */
function go(
  router: Router,
  href: string,
  how: "push" | "replace",
  link: HTMLAnchorElement | null,
  options?: NavigateOptions,
): void {
  const turn = startNavigation({
    to: link ? link.href : new URL(href, location.href),
    via: link ? "link" : "script",
    link,
  });
  pending = turn;
  // The page loads while the leave plays.
  router.prefetch(href);
  turn.left.then(() => {
    // Overtaken by another navigation meanwhile: that one asks the router.
    if (pending === turn) router[how](href, options);
  });
}

/** next/link, with the leave before the router's navigation. */
export function Link(props: ComponentProps<typeof NextLink>) {
  const router = useRouter();
  const anchor = useRef<HTMLAnchorElement | null>(null);
  const { href, replace, scroll, onNavigate, ref } = props as typeof props & {
    ref?: Ref<HTMLAnchorElement>;
  };
  return createElement(NextLink, {
    ...props,
    ref(element: HTMLAnchorElement | null) {
      anchor.current = element;
      if (typeof ref === "function") ref(element);
      else if (ref) ref.current = element;
    },
    onNavigate(event: { preventDefault(): void }) {
      let isStopped = false;
      onNavigate?.({
        preventDefault() {
          isStopped = true;
          event.preventDefault();
        },
      });
      // A URL object is the router's alone to format: it navigates with no leave.
      if (isStopped || typeof href !== "string" || !inBrowser) return;
      event.preventDefault();
      go(router, href, replace ? "replace" : "push", anchor.current, {
        scroll: scroll !== false,
      });
    },
  });
}

/** The App Router, whose push and replace play the leave first. */
export function useTurnRouter(): Router {
  const router = useRouter();
  return useMemo(
    () => ({
      ...router,
      push: (href, options) => go(router, href, "push", null, options),
      replace: (href, options) => go(router, href, "replace", null, options),
    }),
    [router],
  );
}

/** Says when the page reached is in the DOM, from a layout effect, before it is painted. */
function Watcher(): null {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // Once for each page reached.
  useLayoutEffect(() => {
    const here = location.href;
    const isFirst = shownAt === null;
    shownAt = here;
    if (isFirst) return;
    // Not started by pageturn (Back, Forward, a plain next/link): it arrives, plainly.
    const turn = pending ?? startNavigation({ to: here, via: "history" });
    pending = null;
    turn.swapped();
  }, [pathname, search]);
  return null;
}

/** In the root layout, once: tells pageturn when each page is shown. */
export function Pageturn() {
  // useSearchParams needs a Suspense boundary when pages are rendered ahead of time.
  return createElement(Suspense, { fallback: null }, createElement(Watcher));
}
