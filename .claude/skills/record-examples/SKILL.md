---
name: record-examples
description: Use when an example in examples/ changes, when a change to pageturn shows in the README's recordings, or when asked to re-record the GIFs in docs/media/. How to film them, and how to check the frames before trusting them.
---

# Recording the examples

The README shows one GIF per example, in `docs/media/`. `examples/scenarios.ts` lists
each example's steps (a click on a selector, or Back, and the move expected). The spec
`tests/examples/` checks those steps; `scripts/record.mjs` films them.

1. **Test first:** `pnpm exec playwright test tests/examples --project chromium --project firefox`.
   A recording of a broken example is worse than none.
2. **Record:** `pnpm run record` for all of them, or
   `pnpm run build && node scripts/record.mjs morph text` for some. It needs `ffmpeg` on
   the PATH, and starts the server on port 4173 if none answers.
3. **Look at the frames.** A sheet of the whole film:

   ```sh
   ffmpeg -y -loglevel error -i docs/media/text.gif \
     -vf "fps=6,scale=410:-1,tile=4x6" -frames:v 1 /tmp/sheet.png
   ```

   And the travel at the full rate, around the click (adjust `-ss`):

   ```sh
   ffmpeg -y -loglevel error -ss 1.7 -t 0.8 -i docs/media/text.gif \
     -vf "fps=20,scale=300:-1,tile=6x3" -frames:v 1 /tmp/travel.png
   ```

   Check that the move is seen in between: a layer between its two places, a page fading.
   A jump from the first state to the last means the move did not play, even if the spec
   passed. Check also that what is clicked is inside the 820×480 frame.
4. **Size:** each GIF should stay under about 6 MB. Shorten a scenario, or lower `fps` in
   `scripts/record.mjs`, rather than shrinking the frame until text blurs.
5. If the code shown in the README for that example changed, update the README too.
