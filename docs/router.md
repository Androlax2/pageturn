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

## Not yet

- Adapters: this is the engine they are built on.
- The default move as a same-document view transition. It plays pageturn's own CSS for
  now, in every browser.
- `pageturn/morph` on a router.
