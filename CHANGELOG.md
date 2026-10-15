# pageturn

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
