# pageturn

## 1.0.0

### Major Changes

- f3ef048: pageturn 1.0: the public API is stable. What a site imports, the marks on `<html>` and
  their custom properties, the events, and the behaviour written in `docs/contract.md` now
  follow semantic versioning: a minor or patch release never breaks them. Nothing changes
  from 0.2.0 in what pageturn does.

## 0.2.0

### Minor Changes

- f03333d: Warnings in development: in the build package.json's `development` condition serves,
  pageturn says in the console why a move did not play (no head script, reduced motion, a
  client router with no adapter, a return by Back with no animation, a router's own view
  transition alongside pageturn's). Production builds carry none of it.
- f03333d: Next.js: `pageturn/next` plays pageturn's moves on the App Router. Its `Link` (as
  `next/link`) and `usePageturnRouter()` (as `useRouter()`) play the leave before the router
  navigates, and `<Pageturn />` in the root layout says when each page is in the DOM. On
  any client router, the page reached is now recorded where the router shows it, base path
  and trailing slash included, so a return by Back finds its `returnAs` there too.
- f03333d: Nuxt: the `pageturn/nuxt` module puts the head script in every page, adds the stylesheet,
  and plays pageturn's moves on Nuxt's navigations (`<NuxtLink>`, `navigateTo()`, Back and
  Forward), the page reached arriving once Nuxt's `<Suspense>` has resolved.
- 3b16406: Only `decline()` declines: a move's `leave` or a morph's `ends` that answers `false`, the
  form from before `decline()`, now declines nothing (the types already refused it). Return
  `turn.decline()` or `decline()` instead.
- f03333d: React Router: `pageturnMiddleware` on the root route and `usePageturn()` in the root
  layout play pageturn's moves on React Router's navigations (`<Link>`, `navigate()`, Back
  and Forward), the route's loaders running during the leave. `react` and `react-router`
  are optional peer dependencies, used by this adapter only.
- f03333d: SvelteKit: `pageturn/sveltekit` plays pageturn's moves on SvelteKit's own navigations
  (links, `goto()`, Back and Forward), and `pageturn/sveltekit/server` puts the head script
  in every page. Every module of pageturn can now be imported on a server, where it does
  nothing: a framework's layouts run there too.
- f03333d: Turbo: `pageturn/turbo` plays pageturn's moves on Turbo Drive's visits (links, forms,
  `Turbo.visit()`, Back and Forward), holding Turbo's render until the leave has ended. On
  a page Turbo has cached, the preview is not shown under the leave.
- f03333d: Vue Router: `pageturn/vue` plays pageturn's moves on the router's navigations
  (`<RouterLink>`, `router.push()`, Back and Forward). On any client router, a navigation
  to a place in the same page plays no move, and one started from code plays the default
  move rather than asking each move's `match`.

## 0.1.1

### Patch Changes

- d71215f: A fuller package description and keywords, so pageturn is found on npm.

## 0.1.0

### Minor Changes

- c494ce8: First release.
  
  - **The default move.** Every same-origin link plays a short leave and arrival on
    `<main>`. Where the browser has cross-document view transitions it plays them
    natively; elsewhere (Firefox) the package plays the same move. `pageturn.css`, or
    `no-native.css` to play the package's everywhere.
  - **Named moves in CSS.** `data-turn="name"` on a link; `data-turn-leaving` and
    `data-turn-arriving` on `<html>` for your rules. `data-turn="none"` opts out.
  - **Moves in code.** `defineMove(name, { match, leave, arrive, stay })`: run code before
    the page goes, hand data to the next page (`arrival()`, `--turn-<key>`,
    `data-turn-with`), play a return on Back (`returnAs`, `remember`, `whenLeft`).
  - **Arrivals that end by themselves**, once their animations have; `data-turn-entering`
    for a page shown anew; `pageturn:leaving`, `pageturn:stayed`, `pageturn:arrived`.
  - **`pageturn/morph`.** One element travels to its place on the next page, and back on
    Back or a link back. From the markup with `data-turn-morph`, or in code with
    `defineMorph` and its parts: `seen`, `here`, `peek`, `copy`, `text`, `turned`,
    `shadow`, `back`, `linkBack`, `behind`.
  - **Astro integration** (`pageturn/astro`), **classic scripts** for sites without a
    bundler (`pageturn.js`, `pageturn-morph.js`), a strict Content-Security-Policy
    (`pageturn/head` and its hashes), and `pageturn/testing` for Playwright.
- c494ce8: `pageturn/router`: the engine that plays pageturn's moves on a client router's
  navigations, for the adapters to drive (`startNavigation`, then `left`, `swapped` or
  `cancelled`). `Visit` gains `via`, and `Stay.reason` can be `"cancelled"` or
  `"superseded"`.

### Patch Changes

- c9ce823: pageturn/morph reads each corner as it is seen: a parent that clips the picture (a card
  with `overflow: hidden` and round corners) rounds the layer's corners too, so the travel
  no longer starts square and ends with the corners popping in. An end's `radius` may now
  be four corners, from the top-left clockwise; a site's `ends` that does arithmetic on
  it should read it through `typeof radius === "number"`.
