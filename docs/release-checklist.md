# Release checklist

What automation cannot check. Done by hand before each release, on a site using the
release candidate: the packed tarball, `pnpm pack`, which builds `dist/` first (its
`prepack`), so a stale build cannot be packed.

## How a release happens

1. Each change a user will notice comes with a changeset (`pnpm changeset`), merged with
   it.
2. On `main`, the release workflow (`.github/workflows/release.yml`) opens or updates a
   "Version Packages" pull request: the version bumped, `CHANGELOG.md` written.
3. The checks below are done on that version, packed (`pnpm pack`).
4. Merging the pull request makes `main` a release. The workflow publishes its version to
   npm if npm has not got it (`pnpm run release`: build, `lint:package`, `npm publish`,
   with provenance), then creates the tag `pageturn@<version>` and its GitHub release,
   with the version's section of `CHANGELOG.md`.

npm trusts the workflow: Trusted Publishing is set on npmjs.com (package settings,
GitHub Actions, `Androlax2/pageturn`, `release.yml`), and no npm token exists anywhere.
`main` is protected so that only a pull request with a green CI is merged into it.

## Automated, first

- [ ] `pnpm run check`, `pnpm run size`, `pnpm run lint:package` and `pnpm run test`
      pass, and CI is green in all three browsers.

## Back from the back/forward cache

Playwright's browsers do not use the back/forward cache, so a real return is checked by
hand, in **Firefox, Chrome and Safari** (and Zen, which is Firefox underneath):

- [ ] After a move with `returnAs`, Back: the page returned to plays its return once,
      with no flash of its leaving state.
- [ ] After a move without `returnAs`, Back: the page is whole and still, with nothing
      left faded.
- [ ] In Chrome and Safari with `pageturn.css`: after a move with `returnAs`, Back plays
      only the move's return, not the browser's transition as well.
- [ ] A swipe back on a phone or a trackpad: nothing plays a second time over the
      browser's own animation.
- [ ] The arrival ends as the page enters the cache. Arrive on a page by a move, leave it
      by a plain link, come back by Back: the page shows at rest, with no arriving
      animation played again, and `window.pageturn.arrival` is `null`. Then the same
      after a move with `returnAs`: the return plays, even when `returnAs` is the name the
      page first arrived under.
- [ ] That return ends by itself once its animations have, fires `pageturn:arrived` once,
      and carries the `remember` data's `true` keys in `data-turn-with`. Entering the
      cache fires no `pageturn:arrived`.

## Focus given back on a way back

- [ ] In Safari, which focuses no link on a click: a way back by a link, taken with the
      mouse, gives the focus to the link it started from with no ring; taken from the
      keyboard, with one.

## The morph (`pageturn/morph`)

Playwright cannot see a frame, has no back/forward cache, and its WebKit is not Safari.
On a site using `pageturn/morph`, in **Firefox, Chrome and Safari**:

- [ ] The first frame of the page reached: the element is where the layer stopped, with
      no frame of it missing or doubled. Real Safari especially: the layer is built in
      the head, before the body, and that was only ever checked in Chromium and Firefox.
- [ ] A picture, in Firefox: the layer on the page reached shows its picture from the
      first frame.
- [ ] A picture whose large file is not cached, on a throttled network: the small file
      stays drawn until the large one has come, and nothing flashes when it does. With
      a `<picture>` and its `source` elements too.
- [ ] A picture that is slow to draw on the layer: the element under it is hidden only
      once the layer shows it, so the page never shows through.
- [ ] `linkBack()` to a long page: it is put where it was scrolled, and the element
      lands on its place. Also on a page whose height comes late (pictures without
      dimensions).
- [ ] A gallery with "next": closing from another photo lands on that photo's
      thumbnail, and the first one's is not left hidden.
- [ ] Back from the back/forward cache with a layer on screen: the way back plays once,
      from where the page left had the element, and the page is whole afterwards.
- [ ] Back after scrolling the page left so the element is out of view: no way back,
      the page returns plain.
- [ ] Back to a long page that was scrolled: the element lands on its place, not above
      or below it, also when the page is loaded again and not taken from the cache.
- [ ] `text()`: the words do not jump as the layer is swapped for the real element, at
      either end. Look at the first and the last frame, in the three browsers: this is
      where half a pixel shows.
- [ ] `peek()`: on a phone, where nothing is hovered, the page is asked for at the touch
      and the move still plays at the first tap on a normal connection.
- [ ] `behind()`: the page shown behind and the page then reached are the same picture.
      Try it with a page that changes between two loads (a clock, a random order): the
      package cannot make those agree.
- [ ] A dialog, a popover or a menu open as the link is clicked: the layer is above it.
- [ ] `prefers-reduced-motion`: no layer, no hidden element, normal navigation.

## Shown anew

- [ ] In Safari (Playwright's WebKit does not put the scroll back on a reload): a long
      page scrolled down and reloaded shows no entrance, and is drawn scrolled from its
      first frame.

## By eye

- [ ] The default move with `pageturn.css` in Chrome and Safari looks close to the same
      move with `no-native.css`.
- [ ] Safari (real, not WebKit on Linux): a custom move arrives with no frame of the page
      at rest before its arriving half.
- [ ] A slow page (throttle the network): the leave ends, the page waits faded, and
      arrives with its move.

## Release

- [ ] `CHANGELOG.md` has the version and its date.
- [ ] The version in `package.json` is the one the "Version Packages" pull request set.
