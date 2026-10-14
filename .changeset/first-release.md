---
"pageturn": minor
---

First release.

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
