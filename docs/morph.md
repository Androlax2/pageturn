# One element from a page to the next

`pageturn/morph` moves one element, a picture, a card or a headline, from the page left
to its place on the page reached. You say which element and where it lands. Everything
past that is a part you import when you need it, and do not ship when you do not.

Tested in Chromium and Firefox. Not yet run in WebKit.

## From the markup, with no script

```html
<!-- the list -->
<a href="/products/chair"><img data-turn-morph="product" src="chair-small.jpg" alt=""></a>
<!-- the product page -->
<img data-turn-morph="product" src="chair.jpg" alt="Chair">
```

With Astro, `pageturn({ morph: true })`; with a bundler, `import "pageturn/morph/markup"`
on both pages; with neither, `<script src="/pageturn-morph.js"></script>` in the head,
after `pageturn.js` (it puts the rest of this page on `window.pageturn.morph`). A
`defineMorph` from a classic script in the head, before the body, is fine: the travel
waits for the page to be parsed to find where it lands.

That is the morph below, with its defaults: one per name the page's markup gives. The
element that travels is the one with the name inside the clicked link, or the link
itself, or around it, so a list of cards can all say `product`. On the page reached it
lands on the first element with the name. It is found where it was last seen
(`seen()`), and plays back on the browser's Back (`back()`). A `defineMorph` of the same
name, in your own module, takes its place.

## A product card grows into its product page

The same module on both pages:

```ts
import { defineMorph } from "pageturn/morph";

defineMorph("product", {
  from: (link) => link.closest(".card")?.querySelector("img") ?? null,
  to: ".product-hero img",
});
```

```css
html[data-turn-leaving="product"] main { animation: fade-out 0.3s both; }
html[data-turn-arriving="product"] .product-details { animation: rise 0.4s both; }
```

- `from` is asked for every link clicked. It answers the element that travels, or null
  when the link is not this morph's.
- `to` is a selector for the element it becomes on the page reached.
- The name is the move's: the rest of the page leaves and arrives under it, by CSS you
  write, as with any move of pageturn.

What happens: the picture is put on a layer above the page, and the card's own picture
is hidden. The page leaves. The layer crosses the page change, the product page's
picture is hidden under it, the layer travels to that picture's place, and the two are
swapped.

The layer is cropped, never stretched: a square thumbnail becomes a wide picture by its
crop opening, and the corners go from one end's to the other's, each on its own. A
corner is read as it is seen: a card with `overflow: hidden` that rounds the top of its
picture rounds the layer's top too, and the travel lands on those corners on the way
back. A picture with `srcset` asks for the file its new size needs. What the page had drawn stays on the layer until
that file has come: the travel starts at the click and never waits for the network.

If `from` or `to` is a frame that holds its picture larger than itself (a hover's zoom),
the layer's picture is held the same, from one end's hold to the other's.

### Travelling before the page changes: `find`

With nothing more, the layer waits for the page reached, then travels there. If the page
left can know where the element lands, it travels first, and is in place as the page
changes.

```ts
import { defineMorph, seen } from "pageturn/morph";

defineMorph("product", { from, to, find: seen() });
```

| Finder | Answers |
| --- | --- |
| `seen()` | Where the page the link leads to showed the `to` element in this tab, at this window's size; or else where the last other page did (a page of the same template). Never the page being left. Nothing on a first visit |
| `here()` | This page's own element matching `to`, as the page shows it at its top: for two pages of one template (a product to the next product) |
| `peek({ wait: 1500, warm: true })` | Looks at the destination: loads it in a hidden frame as the link is hovered, focused or touched, and measures it there. Waited for `wait` ms at most at the click |
| A function `(to, selector, measure) => End \| null` | Your own estimate |

`find` is one finder or a list, tried in order. An estimate that turns out wrong is
corrected on the page reached, in 300 ms.

`peek()` loads the destination a second time, with its scripts. pageturn is inert in a
frame: `defineMorph` sets nothing up there, and `forgetWayOut` forgets nothing. Your own
scripts that must not run there should check `window.top === window`. Under reduced
motion too, `defineMorph` sets nothing up: no guard is needed around pageturn's calls.

### The head script's morph half

When the travel plays on the page reached (no `find`, no answer, or a way back), the
layer has to be on that page's first frame. A small script in the head does it:

```html
<script src="/pageturn.js"></script>
<script src="/morph-head.js"></script>
```

With Astro, `pageturn({ morph: true })` adds it to every page, and
`pageturn({ morph: ["/products/*", "/gallery"] })` to the pages whose path matches
(`*` stands for anything; a page built as a file, `/index.html` or `/about.html`, is the
page of its path, `/` or `/about`). Name the pages a travel can play on: those reached by a morph
that may not have travelled, and those returned to. `morphHeadScript` and
`morphHeadScriptHash` are exported by `pageturn/head` for a site that inlines it itself.

Without it the morph still plays, from when its module has loaded; the page may show at
rest for a frame first.

## A gallery opens a lightbox page, and closes

```ts
import { back, defineMorph, linkBack } from "pageturn/morph";

defineMorph("photo", {
  from: (link) => (link.matches(".gallery a") ? link.querySelector("img") : null),
  to: ".lightbox img",
  use: [
    back(),
    linkBack({ match: ({ link }) => link.matches(".lightbox .close") }),
  ],
});
```

- `back()` plays it backwards on the browser's Back: the photo shrinks into its
  thumbnail, wherever the gallery was scrolled.
- `linkBack()` does the same for a link that leads back. With `match`, it plays from any
  page that shows the element, also one opened directly (from a search engine, a shared
  link): the page left needs nothing from before. Without `match`, the links that lead
  back are those to the page the way out started on, so it needs that way out.
- A link back puts the gallery where it was scrolled when it was left (`scroll: false`
  not to), as soon as the page is parsed when it has the head script's morph half:
  before your own scripts read the scroll. When there was no way out, or when the link's address names a place of the
  page (`/gallery#spring`), the page is where its address leads, and the photo lands on
  its thumbnail there.

The way back leaves and arrives under the name with `-back`: `photo-back`.

**A link written in the markup.** `<a href="/" data-turn-back="photo">Close</a>` is a
link back without `match`. Written to lead home, it leads where the way out started
when there was one: the package sets its `href`, and its `aria-label` from
`data-turn-back-label` if you give one. It names its own move, so a `data-turn="none"`
around it does not silence it.

**The page returned to is put back, before your scripts run.** As soon as it is parsed:

- the element the way out started from carries `data-turn-origin="photo"`;
- the attributes `keep` names are set as they were when the way out started;
- the popovers it sat in, if they were open as the page was left, are shown again;
- `<html>` carries `data-turn-restoring` until the first frames are drawn. Switch the
  transitions of what is put back off under it: it is there, it does not arrive. It
  does not carry `data-turn-entering`: it is not shown anew.

```ts
linkBack({ keep: { html: "data-menu-from", "nav-capsule": ["data-shown"] } })
```

`keep` (on `back()` too) takes a selector and an attribute, or a list of them. The
first element the selector matches is read as the way out starts, and an attribute that
was not there then is removed on the way back. It is for the state of your own
components: a `<details open>`, an `aria-expanded`, a menu's mark. A component that keeps
its state in a field of its own must read it from those attributes when it starts.

The same in the copy `behind()` shows. It needs the head script's morph half.

Then, in the page itself, the link the way out started from is given the focus back, as
a dialog gives it back to the button that opened it: when the first frames are drawn,
and only if the focus is on the body or inside a popover shown again (a menu that took
it as it opened). Its ring shows if the way out was taken from the keyboard, and not
otherwise, where the browser honours `focusVisible`.

The package remembers where the way out started, for the tab: the link, the scroll, the
element. On the way back it finds the link to the page just left and asks `from` again.
So closing from another photo than the one opened (after "next") lands on that photo's
thumbnail, if the gallery has a link to it.

Nothing plays back when less than a quarter of the element showed as its page was left
(`inView: 0.25`, on either part). The page returned to is then not marked as arriving:
by Back it comes back plain, and a link back plays the default move. Each takes its own `duration`, `delay` and `easing`.

### Two pages that do not load the same script

Each page defines the morph, with what it has. The page of `to` has no link of the
morph, so its `from` answers nothing; it still needs the definition, to take the layer
over and to play the way back. Share what is common:

```ts
// product-morph.ts, imported by both
export const productMorph = { to: ".product-hero img", use: [back()], duration: 600 };

// the list
defineMorph("product", { ...productMorph, from: (link) => cardPictureOf(link), find: seen() });

// the product page: no `from`, it has no link of the morph
defineMorph("product", productMorph);
```

## The parts

Each is an import of `pageturn/morph`. Sizes are gzipped, as a bundler ships them.

| | Size | |
| --- | --- | --- |
| `defineMorph` | 5.3 kB | The core: a picture from a page to the next |
| `here()` | 35 B | Finder: this page has the element too |
| `seen()` | 0.25 kB | Finder: where a page last showed it |
| `peek()` | 0.6 kB | Finder: looks at the destination |
| `turned()` | 0.3 kB | In `use`: reads an element that is rotated when clicked |
| `copy()` | 0.15 kB | In `as`: the layer is a copy of the element, with what it contains |
| `text()` | 1.5 kB | In `as`: the layer is the words, set again at every size, with their box |
| `shadow()` | 0.3 kB | In `use`: carries the shadow of an end that has one |
| `back()` | 1.3 kB | In `use`: the browser's Back plays it backwards |
| `linkBack()` | 1.5 kB (1.7 kB with `back()`) | In `use`: a link back plays it backwards |
| `behind()` | 0.7 kB | In `use`, with `linkBack()`: the page reached shows behind the travel |
| The head script's morph half | 1.1 kB | In the head of the pages a travel plays on |

### `turned()`

The core reads the rectangle an element is drawn in. That is right for an element held
larger by a hover, and wrong for one that is rotated: the rectangle around a tilted card
is larger than the card. `use: [turned()]` reads the element itself, with the rotation
and the scale it and its ancestors hold, and the layer starts tilted.

### `shadow()`

A card with a `box-shadow` that grows into a picture with none: the layer is cropped, so
it cannot cast a shadow itself. `use: [shadow()]` reads each end's `box-shadow` and
casts it under the layer, exactly around it, from one end's to the other's; where an end
has none, it fades. To give a shadow the element does not have as a `box-shadow`, set it
in `ends`: `from.shadow = "0 20px 40px rgb(0 0 0 / 0.3)"` (x, y, blur, colour), or the
computed `box-shadow` of the element that has it, as it is:
`from.shadow = getComputedStyle(frame).boxShadow`.

### `copy()`

`as: copy()` for an element that is not a picture: a card with its name and its price.
The layer is a copy of it at its own size, stretched to the other end's box, corners
included. The copy keeps its classes, so its styles must not depend on where it sits
(`main .card { ... }` would not reach it); it answers to no `id`.

Without `as`, an element that is not a picture is drawn the picture's way: laid out at
the size it grows to, and cropped.

### `text()`

```ts
import { defineMorph, peek, text } from "pageturn/morph";

defineMorph("read", {
  from: (link) => (link.matches(".headline") ? link : null),
  to: "article h1",
  as: text(),
  find: peek(),
});
```

The words are set again as real text at every frame: their size, weight, stretch,
tracking, variation settings and colour go from one end's to the other's. The glyphs
land on the title's own. The element's own box travels behind them, with its fill and
its corners: a button's pill becomes the title's box, and fades out if that has no fill.
If the box you want at an end is not the element's own (a band a little taller than the
line), give it in `ends`: `to.box`, `to.radius`, `to.background`.

**Words that differ.** When the two ends do not say the same thing ("Speak to us"
becomes "Spoke to us"), what they share stays and the part that differs changes on the
way: by default it fades from one to the other, and what follows slides to make room.
`swap` gives the change its own keyframes, for each direction its own:

```ts
as: text({
  swap: ({ back }) => ({
    leave: [{ translate: "0 0" }, { translate: "0 -110%" }],
    arrive: [{ translate: "0 110%" }, { translate: "0 0" }],
    clip: "inset(-0.05em -0.2em -0.25em)",   // where the two words pass
    duration: 340,
    delay: 560,
  }),
}),
```

**A box that is not the element's own.** `text({ box: "::before" })` when the page draws
the box behind its title with a pseudo-element: its place, its corners and its fill are
read from it. The rule that makes it (`content`, `position: absolute`, its insets) has to
apply wherever the title is measured, not only while the page arrives: keep the paint and
the animation under your arrival's mark, and the geometry outside it. When only one end
draws its box that way, name it: `box: { to: "::before" }` leaves the element that
travels with its own box, whatever pseudo-elements it has for other things (a hover's
overlay on a button).

The layer's `transform-origin` is the middle of its box: scale the layer in `during` (a
button that gives under the press) and it scales around what is seen.

An element that is not laid out (a step that is not shown) is still read: its words are
set in a hidden copy, for their size, and `ends` says where they are.

Two ends whose `font-variation-settings` name different axes do not interpolate.

### `behind()`

For a page that closes like a sheet over the one before it. With `linkBack()`, the layer
travels on the page left, to where the way out started, while the page reached shows
behind it, scrolled as it was left and without the element the layer travels to. That
page is loaded in a frame as the link back is
approached, and waited for `wait` ms (800) at most at the click. It then arrives with
`data-turn-behind` on `<html>`, for you to play no arrival over what was already seen.

It comes in over the travel, on its timing, unless your `during` animates it.
`behind({ appear: { duration: 520, delay: 340, easing: "ease-out" } })` gives that fade
its own.

In that copy, `window.pageturn.arrival` is null, as in any frame. What the real page will
arrive with is in `window.pageturn.behind`, `{ move, data }`, from the head on: for a page
that has to put itself as it will be (a menu open, a button pressed).

It relies on the page shown in the frame and the page then loaded being the same
picture. A page that differs between two loads will not agree with itself.

## Your design: three hooks

```ts
defineMorph("product", {
  from, to,
  duration: 750,
  easing: "cubic-bezier(0.65, 0, 0.35, 1)",
  ends({ from, to }, { back, link, measure, decline }) {
    if (!to) return decline();             // nobody knows where it lands: the default move
    to.radius = 0;                         // land square
  },
  during({ layer, content, start, stop, timing, back, finished }) {
    content.animate({ scale: [1.1, 1] }, timing);
    finished.then(() => console.log("landed"));
  },
  data: (turn) => ({ from: "list" }),      // arrival().data on the page reached
});
```

- `ends` is called once the two ends are known, on the page that plays the travel, and
  may change them. When the layer has travelled before the page change, it is called on
  the page reached as well, with the same two ends: the layer is where the hook put it,
  and is compared with what the hook says there. `to` is null on the page left when no finder answered.
  `return decline()` declines: the default move plays. `measure(element)` reads an element the way
  the morph does; `measure(element, other)` reads it as it would be drawn where the
  other is, its corner (its first word, for text) on the other's: for an end that is
  not where its element is. An end is plain data: `box`, `radius` (one number for four
  equal corners, or four from the top-left clockwise), and when they apply `rotate`,
  `zoom`, `shadow`, `background`, and `opacity`. Set `from.opacity = 0` for an end where
  nothing is drawn (a picture that is not on the page until its link is clicked): the
  layer fades in from it, or out to it on the way back. An element that is not laid out
  has no box of its own: `ends` gives it one, or the morph declines.
- `during` is called once per travel, before its first frame. `layer` is what the
  package moves; `content` is what it shows, yours to animate or rebuild; with
  `text()`, `box` is the box behind the words and `words` the words (null with the
  other kinds). The travel ends when every finite animation on the layer has ended,
  yours included. `animate(element, keyframes, options)` animates anything else of
  the page with it: on the travel's timing and `fill: "both"`, `options` over them
  (`{ delay: 0 }` for a delay of its own), waited for as the layer's are, cancelled
  when the page stays, and on the page reached once the layer is swapped, so what it
  ends on must be the element's own style there. Write lengths
  in pixels or percentages: a length in `em` inside a keyframe is not read at the
  animated font size by every browser. `atEnd(() => ...)` reads something of the layer
  as it will be when the travel ends, a word's width in the type it grows to: the
  layer is put there for the time of the call.
- `data` is what the page reached reads as `arrival().data`, as with `defineMove`. With
  `back()` or `linkBack()` it is kept with the way out, and the page returned to is
  handed it too: `arrival().data` by a link back, `arrival().remembered` by Back
  (by Back, `arrival().data` is null, and `arrival().reported` what the page left said).
  `wayOut("product")` reads it on any later page of the tab, with the page the way out
  started on and where it was scrolled: `{ page, scroll, data }`, or null. For a "Close"
  that leads to wherever the visitor came from. It is forgotten when the page it led to
  is reached another way (a plain link, the address bar), and `forgetWayOut("product")`
  forgets it when you say the visit is over.

`stay(turn, stay)` is called when the page stays (the navigation never completed, or
the page is shown again from the back/forward cache), after the layer is removed and
the element shown again: for what else you changed as the page was left. As a move's.

The strings and numbers at the top of that data are also custom properties on `<html>`
while the page arrives, `--turn-<key>`: `data: () => ({ tone: "rgb(14 27 61)" })` is
`var(--turn-tone)` in your arriving CSS, with no script. The keys that are `true` are
words of `data-turn-with`: `data: () => ({ hadHeader: true })` is
`[data-turn-with~="hadHeader"]`. This is the kernel's, for any move.

`arriveAs: "product"` names the arrival when it is not the morph's own name: a product
page reached from the list, from a "related" card and from a search result is three
morphs and one arrival, with one set of CSS.

As a page arrives, its arrival ends with its animations, the layer's included (see the
README): `endArrival()` is not needed after a travel.

`back` is true on a way back, and `link` is the link of the page of `from`: clicked
going out, found again coming back, null on the page of `to`. `scroll` is the scroll the
page will have once the browser has put it where it goes, which on a way back may not
be the scroll it has yet: the ends are given for it, and an end you work out yourself
should be too.

## In your tests

`pageturn/testing` keeps a spec from reading how the layer is built. For Playwright:

```ts
import { endTravel, layer, seekTravel } from "pageturn/testing";

await page.click(".card a");
await expect(layer(page).root).toHaveCount(1);
await seekTravel(page, 300);                 // held 300 ms in, delay included
await endTravel(page);                       // held at its last frame
await expect(layer(page).words).toHaveText("Spoke to us");
```

`layer(page)` has `root`, `content`, and for text `words`, `box` and
`part("head" | "leaving" | "arriving" | "rest")`; `shadow` is the shape under the layer.
A travel held does not end, so the page does not change until `resumeTravel(page)`.

## What a leaving rule cannot reach

A popover or a dialog that is open is drawn above the page, and does not fade with it:
`opacity` on `body` stops at the top layer. Say it in the same CSS half:

```css
html[data-turn-leaving="product"] :popover-open:not([data-turn-layer]) {
  animation: fade-out 0.3s both;
}
```

To play no move for some links, `data-turn="none"` on the link or on anything around it.

## What it never does

- It relies on no rule, class or custom property of your stylesheet. The layer carries
  every style it needs inline, set through the DOM, which a `style-src` without
  `'unsafe-inline'` allows.
- It animates transform on the layer; the crop, the corners and the type are on the
  layer alone, each on an animation of its own.
- Nothing plays under `prefers-reduced-motion`, and nothing is hidden before a script
  runs.

## Limits

- The browser's Back plays the way back when the page it returns to was left by the
  morph. A Back from a page opened directly has no such page to return to.
- A way back to a page with no way out remembered cannot hide the element for the first
  frame: it is hidden a moment later, when the module has found the link.
- One morph with `back()` reports per page; with two whose `to` are both on the page,
  the last defined wins.
- Where the way out started is kept per morph, for the tab: the last one. A page reached
  another way afterwards can still play the way back to it, if its link back matches.
- A link back to an address that names a place (`/gallery#spring`): Firefox may move
  the page one more pixel after it has loaded. The picture has then landed a pixel off.
- The layer's markup crosses in `sessionStorage` and is rebuilt with `innerHTML`: a site
  with Trusted Types has to allow it.
- On a page loaded again, the element to hide for the first frame is found by its
  position in the body. If the page is not built the same, it is hidden a moment later,
  when the module runs.
