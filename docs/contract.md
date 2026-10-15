# Behaviour contract

What pageturn does in every situation. Most rows have a test in `tests/`; the return from
the back/forward cache is checked by hand ([release checklist](release-checklist.md)).
"Normal navigation" means pageturn does nothing: the browser behaves as if it were absent.

## Clicks

| Situation | What happens |
| --- | --- |
| Primary click on a same-origin `a[href]` to another page | A move is chosen and plays, then the page is left |
| A click sent from script (`link.click()`) or by the keyboard | The same. Several in a row play one move |
| A press (pointer down) on such a link, with `pageturn/prefetch` loaded | The page is asked for, once per address |
| Modifier key (Ctrl, Meta, Shift, Alt), middle or right button | Normal navigation |
| The click was already prevented | Nothing: whoever prevented it owns it. pageturn's handler runs after every other one, including handlers added to `window` later |
| Link in editable content | Normal navigation |
| Link in a shadow root | Treated like any link |
| SVG `<a>` | Normal navigation |
| Other origin, a `target` other than `_self` (its own or a `<base target>`'s), `download` | Normal navigation |
| The same path and query as the current page (a `#place` link) | Normal navigation |
| The same path with another query (`?page=2`) | Another page: a move plays |
| `data-turn="none"` on the link or an ancestor; a chooser answers `null`; `defaultMove: null` and nothing else chose | Normal navigation |
| `prefers-reduced-motion: reduce` | Normal navigation, nothing marked, the native transition off too. `defineMorph`, called then, sets nothing up |
| Form submission | Normal navigation |
| Page inside an iframe | pageturn is inert there, and leaves the arrival to the top page. `defineMorph` sets nothing up, and `forgetWayOut` forgets nothing: the page is a copy `peek()` or `behind()` looks at |
| Click before the kernel has loaded | Normal navigation. The arriving half, in the head, is never late |
| Click before a module registered its chooser or move | The move is chosen from what is registered at that instant. A `data-turn` attribute has no such delay |
| Scroll, focus, assistive technology | Untouched: it is a real navigation |

## Choosing the move

In this order:

1. a `data-turn` attribute on the link or an ancestor. It is an explicit choice: the
   named move's `match` is not asked;
2. the choosers, in the order they were added: the first that does not answer
   `undefined`. `null` means no move;
3. the moves' `match`, in the order the moves were defined: the first that answers true;
4. `defaultMove` (`"page"`).

A chooser or a `match` that throws is reported, and the default move plays.

## While a move plays

| Situation | What happens |
| --- | --- |
| `pageturn:leaving` is cancelled | Normal navigation, no attribute, no mark |
| `leave` answers nothing | The CSS half plays if the move has not started it, then the page is left, marked with the move's name |
| `leave` answers `turn.decline()` | Declined: the default move plays in its place. `pageturn:leaving` is not fired again. `false` is not a decline: it is read as nothing |
| `leave` answers a handover | The page is left now, with it |
| The page is still arriving | Its arrival ends as the CSS half starts |
| The CSS half starts no animation | Nothing to wait for: the page is left at once |
| `--turn-leave-max` is set on `<html>` as the leave starts | The wait ends there at the latest; the animations play on while the next page loads |
| An infinite animation starts with the leave | Not waited for |
| The leave lasts longer than `leaveTimeout` (4000 ms) | The page is left with no mark; a late answer is ignored |
| `leave` throws or rejects | The page is left with no mark |
| No `sessionStorage` | `turn.canHandOver` is false. The move still plays; the next page arrives plain |

## After leaving

| Situation | What happens |
| --- | --- |
| The page goes away | The `whenLeft` report runs in `pagehide` |
| It never does (`stuckTimeout`, 4000 ms, from the navigation) | `data-turn-leaving` removed, `stay(turn, { reason: "stuck", handover })`, then `pageturn:stayed` |
| The page comes after that | It still arrives by its move: the mark is kept, and dies at its own 10 s |
| Another link is clicked on the page that stayed | The mark left behind is forgotten: it cannot follow that navigation |
| A mark older than 10 s | Ignored and deleted |
| A page other than the one the mark was left for loads in those 10 s (the address bar, another tab's link), or the page is reloaded, or reached by Back | The mark is deleted, not taken: the page arrives plain. A redirect on the way (`/about` to `/about/`) still counts as the page it was left for |
| Arriving under a name no stylesheet uses | The attribute is set; the page simply shows |

`stay.handover`, in both of `stay`'s reasons, is what `leave` answered: `{}` when it
answered nothing, `null` when the page was left unmarked (ceiling, error).

## Arriving

| Situation | What happens |
| --- | --- |
| The page was reached by a move | `data-turn-arriving` is set before the first frame, and `arrival()` answers. A move of that name the page defines is told by its `arrive`, once the defining code has run |
| The page is shown anew: reached by a link or the address bar, with a move or not | `data-turn-entering` is set before the first frame |
| It was reached by Back or Forward, is in a frame, or motion is reduced | No `data-turn-entering` |
| It turns out to have loaded already scrolled (a reload, a link to a place in it) | The head script removes `data-turn-entering` before a frame shows the page scrolled: it looks after each frame's layout until the page has loaded. That is not an end: no `pageturn:arrived` for it |
| The visitor scrolls (after a wheel, touch, key or press of theirs), or anything scrolls once the page has loaded | `data-turn-entering` stays |
| What crossed has top-level strings or numbers: by a link the move's data; by Back what the entry remembered and what the page left reported | Each is `--turn-<key>` on `<html>` for the time of the arrival |
| What crossed has top-level keys that are `true` | Each is a word of `data-turn-with` on `<html>`, for the same time |
| `arrivalEnds: "animations"` (the default) | Two frames after the page is parsed, the kernel waits until no animation is running: those of the CSS and those of scripts, one started as another ends included. Then it ends the arrival |
| A CSS transition or an infinite animation is running | Not waited for |
| `--turn-arrive-max` is set on `<html>` as the wait starts | The wait ends there at the latest, and at 10 s in any case |
| `arrivalEnds: "manually"` | The marks stay until the page calls `endArrival()` |
| The page calls `endArrival(move)` | `data-turn-arriving`, `data-turn-entering` and `data-turn-with` are removed, and the custom properties the arrival set, if the arrival is `move`'s (any, with no argument). `arrival()` keeps answering |
| The site sets `--turn-*` properties of its own on `<html>` (`--turn-shift`, `--turn-leave-max`) | Kept when the arrival ends. One the arrival's data covered comes back; one the site wrote over the arrival's stays as the site wrote it |
| The page removes `data-turn-arriving` itself | Tolerated. The kernel still ends what is left |
| A leave starts while the page is arriving | The arrival ends first: a page is never arriving and leaving at once |
| The arrival ends, by any of these | `pageturn:arrived` on the document, once, with `{ move, entering, whole }`. `move` is null for a page shown anew with no move. `whole` is false when it was cut short: by a leave, or with `"animations"`, by `endArrival()` or by the page removing the mark |
| The arrival was ended before the kernel started | No `pageturn:arrived` |
| The page enters the back/forward cache | Its arrival ends, with no event: the marks are removed, `arrival()` answers `null`. Shown again, it is plain or arrives anew under its move's `returnAs`, with its custom properties and `data-turn-with`, and ends as any arrival |

## Back and Forward

The page left by Back never plays a leave: a page cannot hold a Back.

| Situation | What happens |
| --- | --- |
| Returned to a page left by a move that declared `returnAs`, the page just left being the one the move went to, less than 3 s ago | `data-turn-arriving` is set to `returnAs`; `arrival()` has `via: "history"`, `data: null`, the move's `remember` as `remembered` and the page left's `whenLeft` report as `reported`. The move named `returnAs`, if the page defines it, is told by its `arrive` |
| The same, from the back/forward cache | The same: the page left's move gets `stay(turn, { reason: "returned", handover })`, then `pageturn:stayed`, then the move named `returnAs` its `arrive` |
| The page left answered `leaving.decline()` in its `whenLeft` report | No arrival: the page returns plain |
| No `returnAs`, another page between, or more than 3 s | No arrival. From the cache, `stay` still runs |
| Shown from the cache again later (Forward, then Back), with no turn under way | The return plays again, from what the entry kept, as after a reload |
| `history.state` is not a plain object (a router's array) | Left as it is: no return is kept with that entry |
| The default move | No return in the package's rendering. Where the browser plays it natively, the browser decides |

## The native rendering

Only with `pageturn.css`, the `pageturn` entry (or `pageturn/native`) and the full head
script, and only where the browser has cross-document view transitions (Chrome, Edge,
Safari):

| Situation | What happens |
| --- | --- |
| The default move, with no `leave` of its own | The click is not held: the browser navigates and animates. `arrival()` answers as usual |
| Any other move, or an opted-out link | The protocol plays; the browser's transition is skipped |
| A page reached without the native stylesheet | The package's arriving half plays instead |

`no-native.css`, no package stylesheet, `pageturn/core` alone, or the head script without
its native half: the protocol in every browser. (`pageturn.css` with `pageturn/core` alone
is a mistake: nothing then keeps the browser's transition from playing over a move.)

## Failure

| Situation | What happens |
| --- | --- |
| JavaScript off | No attribute ever set; with `pageturn.css`, the native rendering still plays where it exists |
| Head script ran, kernel never loaded | Arriving halves play; links navigate normally |
| Kernel loaded, no head script | The kernel is inert: links navigate normally, nothing is marked |
| Loaded twice (inline head script and `pageturn.js`, or the classic and the ESM build) | The second is a no-op; one registry is shared |

## Client routers (`pageturn/router`)

A navigation a client router makes inside the page, driven by an adapter
([router.md](router.md)). Needs the head script, which marks the first page.

| Situation | What happens |
| --- | --- |
| The router handles a link | The move is chosen as for any click (`data-turn`, choosers, `match`, the default) and plays its leave. The router swaps the content only once the leave has ended |
| The router navigates from code | The move the adapter names, or the default move. `match` and the choosers are not asked; `turn.link` is an `<a>` to the destination that is not in the page, and `turn.via` is `"script"` |
| The new content is in | The page reached is where `location` says (a router may add a base path, a trailing slash, follow a redirect). In the same task: `data-turn-leaving` removed, `data-turn-arriving` set with what the move carried (`--turn-<key>`, `data-turn-with`), `data-turn-entering` set. `arrival()` answers the new arrival, and the move's `arrive` is told |
| Back and Forward | No leave. The page arrives under the `returnAs` of the move that left it, with `remembered` and `reported`, or plainly. Not shown anew |
| Where a return is kept | Per history entry, by the Navigation API's entry key where there is one, by the address otherwise; in `sessionStorage`, never in `history.state`, which the router owns. The last 50 entries |
| `whenLeft` | Asked as each navigation starts. On Back the address has already changed: a report reads what it describes from the page, not from `location` |
| A second navigation during a leave | The first ends: its move's `stay` gets `reason: "superseded"`, then `pageturn:stayed`. The second plays its own move |
| The router gives the navigation up | `data-turn-leaving` removed, `stay` with `reason: "cancelled"`, `pageturn:stayed`. The page is usable at once |
| A leave that throws or outlasts `leaveTimeout` | The router swaps with no move, as a real navigation goes unmarked |
| `pageturn:leaving` cancelled, `data-turn="none"`, a chooser answers `null` | The router navigates with no move. The page swapped in is still shown anew |
| Slow data | The page waits in its leaving state until the router swaps. `stuckTimeout` does not apply |
| The same path and query (`#place`, a router that navigates within the page) | No move: the router navigates as if pageturn were not there |
| Reduced motion, a frame, no head script | Inert: the router navigates, nothing is marked |
| Imported where there is no document (a framework rendering on the server) | Nothing happens. `defineMove` registers, `arrival()` answers `null`, `startNavigation` answers a navigation that does nothing |

### SvelteKit (`pageturn/sveltekit`)

| Situation | What happens |
| --- | --- |
| A link, `goto()`, a form SvelteKit handles | A move plays, as above. The leave starts as SvelteKit starts the navigation, while it loads the page's data |
| Back and Forward | No leave; the page arrives under its `returnAs`, as above |
| Another `beforeNavigate` cancels it | `cancelled`: the page is put back, as above |
| A link SvelteKit leaves to the browser (`data-sveltekit-reload`, another app) | A real navigation, handled by the kernel: its move plays as between real pages |
| The page as SvelteKit renders it on the server | `pageturnHandle()` puts the head script right after `<head>` and its charset |

### Turbo (`pageturn/turbo`)

| Situation | What happens |
| --- | --- |
| A link, a form, `Turbo.visit()` Turbo handles | A move plays. The leave starts at `turbo:before-visit`; Turbo's render waits for it |
| A page Turbo has cached | Its preview is not rendered while a move plays: the page left stays leaving until the real render, and the page arrives once |
| Back and Forward (restoration visits) | No leave; the page arrives under its `returnAs` |
| Another listener cancels `turbo:before-visit`, or the fetch fails | `cancelled`: the page is put back |
| A link Turbo leaves to the browser (`data-turbo="false"`) | A real navigation, handled by the kernel, with its move |

### Vue Router (`pageturn/vue`)

| Situation | What happens |
| --- | --- |
| `<RouterLink>`, `router.push()` | A move plays: a link's for a link, the default move for code. The router waits for the leave in `beforeResolve` |
| Back and Forward | No leave; the page arrives under its `returnAs` |
| A guard aborts it, a newer navigation cancels it, a guard throws | `cancelled`: the page is put back |
| A `#place` in the same route | No move |
| The app's first navigation | No move |

### Nuxt (`pageturn/nuxt`)

The Vue Router rows, on Nuxt's router, and:

| Situation | What happens |
| --- | --- |
| The page reached is shown | At `page:finish`, once Nuxt's `<Suspense>` has resolved; 4 s after the router's `afterEach` at the latest |
| Every page Nuxt renders | The head script first among `app.head`'s scripts (`tagPriority: "critical"`) |

### React Router (`pageturn/react-router`)

| Situation | What happens |
| --- | --- |
| `<Link>`, `navigate()` | A move plays: a link's for a link, the default move for code. The route's loaders run during the leave; the router commits once both are done |
| Back and Forward | No leave; the page arrives under its `returnAs` |
| A navigation overtaken by the next | Its move's `stay` hears `superseded`; the next plays its own |
| The router aborts it and nothing follows | `cancelled` |
| The first load | No move: the middleware passes until the root layout has mounted |
| `<Link reloadDocument>` | A real navigation, handled by the kernel, with its move |

### Next.js (`pageturn/next`)

| Situation | What happens |
| --- | --- |
| pageturn's `Link`, `usePageturnRouter().push()` | Next's navigation is stopped, the leave plays while the page is prefetched, then the router navigates; the page arrives as `<Pageturn />` sees it |
| A `Link` whose own `onNavigate` calls `preventDefault()` | Nothing: no leave, no navigation |
| A plain `next/link`, a bare `router.push`, Back and Forward | No leave. The page arrives: under its `returnAs` on Back when it has one, plainly otherwise |
| A navigation overtaken during its leave | Its move's `stay` hears `superseded`, and the router is never asked to go there |
| A `Link` with a URL object as `href` | Left to Next: no leave, the page arrives plainly |

## In development

From the build `package.json`'s `development` export condition serves (`dist/dev/`); a
production build carries none of it.

| Situation | What is said, once, in the console |
| --- | --- |
| The kernel loads on a page with no head script (not in a frame) | The head script is missing: links navigate with no move |
| The kernel installs under reduced motion | Nothing plays, and why |
| A click someone else prevented leads, 300 ms later, to the link's address, and `pageturn/router` is not on the page | A client router took the link, with no adapter |
| A page returned to by history, under a move, has no animation running two frames after it is parsed | It shows at once: animate it in under that move |
| `swapped()` while `:active-view-transition` matches | The router plays its own view transition alongside pageturn |
