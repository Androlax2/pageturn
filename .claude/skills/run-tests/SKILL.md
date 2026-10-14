---
name: run-tests
description: Use when running, writing or debugging pageturn's Playwright specs: how to run one spec or one browser, how the test server and fixtures work, and what to do when a run hangs, fails only under load, or a browser will not start.
---

# Running pageturn's tests

## Running

```sh
pnpm run build                                    # specs load the built files
pnpm exec playwright test                         # every spec, every browser
pnpm exec playwright test tests/morph --project chromium --project firefox
pnpm exec playwright test -g "lands once" --project firefox
pnpm run test                                     # build, Astro fixture, everything
```

`tests/astro/` needs its fixture built (`node tests/astro/fixture/build.mjs`), which
`pnpm run test` does.

## How a spec gets its pages

- `serve(context, { name: PageSpec })` from `tests/support/site.ts` answers `/t/<name>`
  with a page built from the spec: which kernel it loads (`classic`, `full`, `core`,
  `no-head`), which stylesheet, extra head HTML, body, a closing script, headers.
- Every such page has `note(key, value)`, which writes to `sessionStorage`, so a test can
  read with `noted(page, path, key)` what happened on a page it has already left.
- `tests/support/server.mjs` serves `/dist/`, `/plain/` (kernel fixture), `/astro/` and
  `/examples/` on port 4173.

## When something is wrong

- **Every request 404s, or a route is missing:** a server from an older run still holds
  port 4173 and is reused. Find it (`ss -ltnp | grep 4173`) and stop it by PID. Do not
  `pkill -f server.mjs`: the pattern can match the shell that runs it.
- **A spec fails only under load:** it probably reads a note or a mark once instead of
  waiting for it. Use `expect.poll`. Check with
  `--repeat-each 20 --workers 12` before calling it fixed.
- **A failure only in Chromium with `pageturn.css`:** the default move may be the
  browser's own view transition there. `data-turn-arriving` is not set then; the
  transition's type names the move.
- **Firefox crashes at launch in a sandboxed shell:** set the `MOZ_DISABLE_*_SANDBOX=1`
  variables (content, GMP, RDD, socket process, utility, GPU) and point `HOME` and the
  `XDG_*` folders at writable places.
- **WebKit will not launch locally:** on some Linux hosts it lacks system libraries. It
  runs in CI; say it was not run.

## Limits

Playwright has no back/forward cache, cannot see a single frame reliably, and its WebKit
is not Safari. Those checks are in `docs/release-checklist.md`, by hand.
