# Client routers

`pageturn/router` plays pageturn's moves on the navigations a client router makes inside
the page: SvelteKit, Vue Router, React Router, Next.js, Turbo. A site writes the same
things as between real pages: the marks on `<html>`, its CSS, `defineMove`, `arrival()`
and the events. Only the page load in the middle is replaced by the router's swap.

This page is for whoever connects a router: the adapters, and a site with a router of
its own. What happens in each situation is in [contract.md](contract.md#client-routers-pageturnrouter).

## The sequence

```
navigation starts ─▶ data-turn-leaving, the leave plays ─▶ left resolves
   (the router fetches meanwhile)                          │
                                                           ▼
                         the router swaps the content, then swapped(), in one task
                                                           │
                         data-turn-leaving ─▶ data-turn-arriving, before the next frame
```

## The adapter's three calls

```ts
import { startNavigation } from "pageturn/router";

// When the router starts a navigation:
const navigation = startNavigation({
  to,                // a URL, or a string read against the page's address
  via: "link",       // "link", "script" (from code) or "history" (Back, Forward)
  link,              // the <a> clicked, if the router knows it
  move: "card",      // optional: the move to play, null for none
});

await navigation.left;   // never rejects; at once for Back or with no move
// ... the router puts the new content in the DOM ...
navigation.swapped();    // in the same task as that DOM update
// or, if the router gives the navigation up:
navigation.cancelled();
```

- **Wait for `left`, both ways.** Start fetching as the navigation starts, and swap when
  both the data and `left` are there. The page fades while the next one loads, as
  between real pages.
- **Call `swapped()` in the same task as the DOM update**, before anything awaits. The
  new content takes the place of the old under the leaving mark. A frame painted between
  the two shows it at the start of its leaving animation: visible, then fading.
- **Every navigation is told, Back and Forward too.** `via: "history"` plays no leave;
  `swapped()` is what lets the page arrive under its `returnAs`.
- **A navigation that starts during another** ends that one (its move's `stay` hears
  `"superseded"`). The router should then drop the first: never call `swapped()` for a
  navigation it has given up.
- **The link.** When the router does not pass the `<a>`, the engine takes the one
  clicked to the same address in the last second, so a move's `match` still sees it.

## The head script

Every page still needs the head script first in `<head>` (see the README): it marks the
first page before its first frame, and keeps what an arrival carries for CSS. Without it
the engine does nothing. A site that has both client and real navigations loads the
kernel too (`pageturn` or `pageturn/core`): it handles the links the router leaves alone.
The moves are defined once, for both.

## The router's own transitions

Turn them off where pageturn plays: two systems animating one swap is the likeliest bug.
That means SvelteKit view-transition recipes, Nuxt's `experimental.viewTransition`,
React Router's `viewTransition`, Next.js's experimental view transitions, Turbo's
`view-transition` meta tag, and Astro's ClientRouter animations.

## Adapters

- **SvelteKit**, `pageturn/sveltekit` and `pageturn/sveltekit/server`: see the README.
  It starts the navigation in `beforeNavigate`, while the address is still the page's
  (SvelteKit pushes the history entry before `onNavigate`), waits for `left` in
  `onNavigate`, and calls `swapped()` from the function `onNavigate` returns, which
  SvelteKit calls once the DOM is updated. SvelteKit skips `beforeNavigate` during a
  redirect and for a navigation started while another runs: the adapter starts it in
  `onNavigate` then. A rejected `complete` (cancelled, failed, overtaken) is
  `cancelled()`.

- **Turbo**, `pageturn/turbo`: see the README. It starts the navigation on
  `turbo:before-visit`, before Turbo pushes the history entry (Back and Forward on
  `turbo:visit` with `action: "restore"`), holds `turbo:before-render` until `left`, and
  calls `swapped()` from the render function it wraps, right after the new body goes in.
  A preview of a cached page renders nothing while a move plays. A visit another
  listener cancels, or a failed fetch, is `cancelled()`.

- **Vue Router**, `pageturn/vue`: see the README. It starts the navigation in
  `beforeEach`, before the router changes the address (Back and Forward are told by the
  router's history listener), waits for `left` in `beforeResolve`, after the route's
  components have loaded, and calls `swapped()` in a microtask after `afterEach`, once
  Vue has patched the DOM. A failure in `afterEach` (a guard aborted it, a newer
  navigation cancelled it) or an error is `cancelled()`. The app's first navigation
  plays nothing.

- **Nuxt**, `pageturn/nuxt`: the Vue Router adapter on Nuxt's router, from a client
  plugin the module adds. It calls `swapped()` at `page:finish`, once Nuxt's `<Suspense>`
  has resolved and the page is in the DOM; 4 s at most, so a page that never says so
  does not stay faded. The module puts the head script first in `app.head`.

- **React Router**, `pageturn/react-router`: a middleware on the root route starts the
  navigation, runs `next()` (the loaders) alongside `left`, and returns once both are
  done; `usePageturn()` in the root layout calls `swapped()` from a layout effect on the
  location. Back and Forward are told by a capturing `popstate` listener, which runs
  before the router's. The router aborts a navigation as the next one starts, before that
  one reaches the middleware: the adapter waits a task before it calls the abort
  `cancelled()`, so the engine has ended it as `superseded` first.

- **Next.js**, `pageturn/next`: the App Router cannot hold a navigation, so the adapter
  stops it and asks again. Its `Link` wraps `next/link`: `onNavigate` prevents Next's
  navigation (unless the site's own `onNavigate` did), starts the leave with the
  rendered anchor's address (the base path Next adds), prefetches the page, and calls
  `router.push` or `router.replace` once `left` resolves, unless another navigation
  started meanwhile. `useTurnRouter()` does the same from code. `<Pageturn />`, in the
  root layout, calls `swapped()` from a layout effect on the path and query; a page it
  did not start (Back, Forward, a plain `next/link`) arrives through `via: "history"`,
  under its `returnAs` when it has one, plainly otherwise.

An adapter that cannot tell a click from code passes `via: "link"`: with no link clicked
to that address in the last second, the engine takes it as code, and plays the default
move rather than a link's.

Every module of pageturn can be imported where there is no document, as a framework's
layout is on the server: nothing happens there, and the API answers as on a page with no
arrival.

## Not yet

- Adapters for Astro's ClientRouter
  and Inertia.
- The default move as a same-document view transition. It plays pageturn's own CSS for
  now, in every browser.
- `pageturn/morph` on a router.
