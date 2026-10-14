/** The `linkBack()` part of pageturn/morph. */
import { defineMove } from "../kernel/core.ts";
import { markup } from "./layer.ts";
import { type End, onPage } from "./place.ts";
import type { Part } from "./types.ts";
import {
  backFields,
  IN_VIEW,
  type LinkBackOptions,
  shareOnScreen,
  wayBackOf,
} from "./way.ts";

/**
 * Plays the morph backwards for a link that leads back. The layer holds still while the
 * page leaves, and travels on the page reached, as on a Back; or before the page changes,
 * with `behind()`.
 */
export function linkBack(options: LinkBackOptions = {}): Part {
  return (stage) => {
    const way = wayBackOf(stage);
    way.byLink = options;
    Object.assign(way.keep, options.keep);
    const isMarked = (link: Element): boolean =>
      link.getAttribute("data-turn-back") === stage.name;
    way.leadsBack = (visit) => {
      // A link marked `data-turn-back` leads back. With `match`, so do those it names:
      // neither needs a way out before it, the page may have been opened directly.
      // Without either, the links back are those to where the way out started.
      if (isMarked(visit.link)) return true;
      return options.match
        ? options.match(visit)
        : visit.to.pathname === way.origin()?.f;
    };
    // `<a data-turn-back="name">`: a link written to lead somewhere (home) leads where
    // the way out started instead, when there was one. It names its move itself, so that
    // a `data-turn="none"` around it does not silence it.
    const started = way.origin();
    for (const link of document.querySelectorAll<HTMLAnchorElement>(
      "a[data-turn-back]",
    )) {
      if (!isMarked(link)) continue;
      link.dataset.turn = way.name;
      if (started && started.f !== link.pathname) {
        link.href = started.f;
        // A label for when it leads elsewhere than where it was written to.
        const label = link.dataset.turnBackLabel;
        if (label) link.setAttribute("aria-label", label);
      }
    }
    stage.onRemove.push(
      defineMove(way.name, {
        match: way.leadsBack,
        async leave(turn) {
          // Where the way out started, when this link leads there.
          const origin = way.origin();
          const from = origin?.f === turn.to.pathname ? origin : null;
          const element = onPage(stage.morph.to);
          // As a way out: no storage, or a layer already out, and it cannot play.
          if (!element || !turn.canHandOver || stage.live) {
            return turn.decline();
          }
          const about = stage.about(null, true);
          let end = stage.read(element);
          let stop: End | null = null;
          if (from && way.aims) {
            const aimed = way.aims(from, end, about);
            if (aimed === false) return turn.decline();
            ({ stop, end } = aimed);
          }
          // On the end as the site's `ends` left it: an element that is not on screen
          // may have been given a place that is.
          if (shareOnScreen(end.box) < (options.inView ?? IN_VIEW)) {
            return turn.decline();
          }
          const frame =
            from && stop
              ? ((await way.frameBehind?.(turn, from)) ?? null)
              : null;
          const layer = await stage.put(element, end, stop);
          const leaving = turn.leaving();
          if (stop) {
            await stage.travel(
              end,
              stop,
              about,
              stage.timing(options),
              true,
              frame,
            );
          }
          await leaving;
          // By a link the page is at its top: it is put where it was left, unless told
          // not to, or unless the address names a place of its own.
          const scrollsBack =
            from && (stop || (options.scroll !== false && !turn.to.hash));
          stage.hand({
            n: way.name,
            m: way.name,
            h: markup(layer),
            e: stop ?? end,
            ...(stop ? { f: end } : {}),
            t: Boolean(stop),
            b: Boolean(frame),
            ...backFields(from, stage.name),
            ...(from && scrollsBack ? { x: from.x, y: from.y } : {}),
          });
          // What the site said as the way out started, back where it started.
          return { data: from?.d ?? null };
        },
        stay(turn, stay) {
          stage.drop();
          way.dropFrame?.();
          stage.morph.stay?.(turn, stay);
        },
      }),
    );
  };
}
