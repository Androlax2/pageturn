---
name: change-behaviour
description: Use when adding a feature to pageturn or changing what it does (a move, the head script, the kernel, the morph, the Astro integration). The checklist that keeps the code, the contract, the docs, the tests, the sizes and the changelog in step.
---

# Changing what pageturn does

1. **Find the rule first.** Read the rows of `docs/contract.md` for the area, and the spec
   that tests them (`tests/<area>/`). Decide the new behaviour as a row of the contract
   before writing code. Check it serves any site, not one (see AGENTS.md, "Generic").
2. **Write the spec.** Add a test that fails today, in the area's spec file, serving its
   pages with `serve()` from `tests/support/site.ts`. Run it in Chromium and Firefox and
   see it fail for the right reason.
3. **Change the code** where the behaviour lives:
   - before the first frame (marks on `<html>`, `window.pageturn`): `src/head/`;
   - clicks, choosing, leaving, arriving, events, settings: `src/kernel/`;
   - the default move's CSS: `src/default-move/pageturn.css`;
   - the morph: `src/morph/` (the core in `define.ts`, each part in its own file).
   A property shared by the head script and the kernel goes in `INTERNAL` in
   `scripts/build.mjs`.
4. **Run the spec again**, then the area's whole folder, in both browsers.
5. **Write it down:**
   - `docs/contract.md`: the row, in the table of its area;
   - `README.md` or `docs/morph.md`, when a user writes something differently;
   - the public types in `src/common/types.ts` or `src/morph/types.ts`, with their doc
     comments, which are what an editor shows;
   - `pnpm changeset`: one or two sentences in the user's terms (`patch` for a fix,
     `minor` for a feature, `major` only for a breaking change, decided with Théo).
6. **Check:** `pnpm run check`, `pnpm run size` (raise a target only when the bytes are
   needed, and say how many), `pnpm run lint:package` when exports or files changed.
7. **Examples:** if the change shows in an example, run `tests/examples/` and re-record
   (the `record-examples` skill).
8. **Report** what changed, what was tested in which browsers, and that WebKit is left to
   CI if it was not run.
