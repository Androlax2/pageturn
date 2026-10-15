# pageturn: notes for coding agents

pageturn plays page transitions between real page loads: a leave on the page left, an
arrival on the page reached, and a real navigation between them. It is a public npm
package for any site. Read `README.md` first for what it does, and `docs/contract.md`
for what it does in every situation.

## Commands

```sh
pnpm install
pnpm run build          # dist/, with esbuild (scripts/build.mjs) and tsc for the types
pnpm run check          # Biome (warnings fail), the build, and tsc --noEmit
pnpm run test           # build, the Astro fixture, then Playwright in every browser
pnpm exec playwright test tests/kernel/moves.spec.ts --project chromium   # one spec
pnpm run size           # gzipped sizes against their targets (scripts/size.mjs)
pnpm run lint:package   # publint and attw: the package as npm will serve it
pnpm run examples       # the examples on http://localhost:4173/examples/
pnpm run record         # films the examples into docs/media/*.gif (needs ffmpeg)
```

`make <target>` runs the same scripts. Before calling a change done: `check`, `size`, and
the tests in Chromium and Firefox at least. WebKit runs in CI; say so when it was not run
locally.

## Layout

| Path | What it holds |
| --- | --- |
| `src/head/` | The head script: a classic script that runs before the first frame, works out how the page was reached, marks `<html>` and publishes `window.pageturn` |
| `src/kernel/` | The kernel, a module: clicks, choosing a move, the leave (`turn.ts`, shared with the router engine), the hand-over, the arrival's end. `core.ts` is the public API |
| `src/common/` | What both halves share: types, the registry, `sessionStorage`, page helpers |
| `src/default-move/` | The default move: `pageturn.css` (and `no-native.css`, built from it), and the hand-off to native view transitions |
| `src/prefetch/` | Prefetch on press |
| `src/morph/` | `pageturn/morph`: one element from a page to the next. `define.ts` is the core; each other file is a part a site imports when it needs it |
| `src/router/` | `pageturn/router`: the same moves on a client router's navigations, driven by an adapter's three calls |
| `src/sveltekit/` | The SvelteKit adapter (the router engine on SvelteKit's hooks) and its server `handle` |
| `src/turbo/` | The Turbo Drive adapter (the router engine on Turbo's events) |
| `src/vue/` | The Vue Router adapter (the router engine on its guards), which pageturn/nuxt builds on |
| `src/nuxt/` | The Nuxt module (Node) and the client plugin it adds |
| `src/react-router/` | The React Router adapter: a root middleware and a layout hook |
| `src/next/` | The Next.js App Router adapter: its `Link`, `usePageturnRouter()` and `<Pageturn />` (a client module, `"use client"`) |
| `src/classic/` | `pageturn.js` and `pageturn-morph.js`, for sites with no bundler |
| `src/astro/` | The Astro integration |
| `src/testing/` | `pageturn/testing`, for a site's own browser tests of a morph |
| `tests/` | Playwright specs, by area. Each framework has a fixture app, built by `pnpm run test` (`tests/astro/fixture`, `tests/sveltekit/fixture`, `tests/turbo/fixture`, `tests/vue/fixture`, `tests/nuxt/fixture`, `tests/react-router/fixture`, `tests/next/fixture`); `tests/support/framework.ts` is what their specs share. `tests/support/site.ts` serves pages described in the spec itself; `tests/support/server.mjs` serves `dist/`, the fixtures and the examples |
| `examples/` | Plain HTML examples. `examples/scenarios.ts` lists their steps, read by `tests/examples/` and `scripts/record.mjs` |
| `docs/` | `contract.md` (the behaviour), `morph.md` (the morph's guide), `router.md` (connecting a client router), `release-checklist.md`, `media/` (the README's recordings) |

## Rules

- **Generic.** pageturn serves any site. An option exists because any site could need it;
  site-specific behaviour belongs in the site's own hooks. Shipped code never relies on a
  site's styles: what pageturn draws (the morph's layer) is styled inline, from script.
- **Correctness before size.** A change works first, then is made small. The size targets
  in `scripts/size.mjs` are set from what is built: raise one when a correct change
  needs the bytes, and say by how much and why.
- **The head script is special.** It is classic, inline, and runs before `<body>` exists:
  no imports at runtime (the build inlines them), nothing that waits, nothing that reads
  the body without waiting for it to be parsed. Its size matters most.
- **Internal names are mangled.** `scripts/build.mjs` shortens the property names in
  `INTERNAL` identically across the separately built files. A property the head script
  and the kernel share goes in that list. A name in it must not also be a public or DOM
  property name, or that gets shortened too.
- **Behaviour is written down.** A change to what pageturn does updates
  `docs/contract.md` (and `README.md` or `docs/morph.md` when users see it), comes with a
  spec in `tests/`, and with a changeset (`pnpm changeset`) when users will notice it.
- **Reduced motion and frames.** Under `prefers-reduced-motion: reduce` nothing is marked
  and links navigate normally. In an iframe pageturn is inert.
- **No dependencies at runtime.** A framework an adapter is for is an optional peer
  (`astro`, `react`, `react-router`, `next`), kept out of pageturn's bundle (`external` in
  `scripts/build.mjs`). Where the framework's functions are not a package (SvelteKit's
  `$app/navigation`), the adapter takes them from the site, as
  `pageturn({ beforeNavigate, onNavigate })` does.
- **Safe to import on a server.** Frameworks render layouts on the server: no module
  touches `document`, `window` or `location` as it loads, and the API does nothing
  there (`inBrowser` in `src/common/page.ts`). `tests/package/server.spec.ts` imports
  every entry with no document.
- **Development warnings** go under `if (DEV)` (`src/common/flags.d.ts`) and through
  `warn()` (`src/common/dev.ts`). The module entries are built twice: `dist/` with DEV
  false, the branches dropped; `dist/dev/` with it true, served by package.json's
  `development` condition. `tests/package/development.spec.ts` triggers each one.
- **Never publish.** Releases go through the Changesets pull request and CI
  (`docs/release-checklist.md`). Do not run `npm publish` or `changeset publish`.

## Style

- TypeScript, strict, with `.ts` extensions in imports. Biome formats and lints; run
  `pnpm run format` rather than formatting by hand.
- Names say what a thing is in the page's terms: a *move*, its *leave* and *arrival*, the
  *turn*, the *mark*, a morph's *layer*, *ends* and *travel*. Read the names around a
  change before adding one.
- Comments say why, in plain sentences, at the density of the code around them. A
  file starts with a short comment saying what it is. No comment that repeats the code,
  and no reference to a plan, a revision or a particular site.
- Tests describe behaviour in their titles ("a leave that throws navigates with no
  move"), and serve the pages they need with `serve()` from `tests/support/site.ts`.

## Running browsers

- Specs need the built files: `pnpm run build` first, or use `pnpm run test`.
- The test server listens on port 4173 and is reused if one is already running. A server
  left over from an older checkout serves old routes: stop it by its PID before
  running again (a `pkill -f server.mjs` can match the shell that runs it).
- Playwright's browsers have no back/forward cache, and its WebKit is not Safari. What
  they cannot see is in `docs/release-checklist.md`, checked by hand.
