/** The `behind()` part of pageturn/morph. */
import { isDeclined } from "../common/registry.ts";
import { within } from "./end.ts";
import { loadInFrame, onApproach } from "./frame.ts";
import { type End, MORPH_KEY } from "./place.ts";
import type { Leg, Part } from "./types.ts";
import { type Origin, putBackFields, wayBackOf } from "./way.ts";

/** How long a link back waits for the page it shows behind the layer. */
const BEHIND_WAIT_MS = 800;

/**
 * For a page that closes like a sheet over the one before it. With linkBack(): the layer
 * travels on the page left, to where the way out started, while the page reached shows
 * behind it, scrolled as it was left. That page is loaded in a frame as the link back is
 * approached, and waited for `wait` milliseconds at most at the click.
 */
export function behind(
  options: {
    /** How long the click waits for the page behind, in ms. Default 800. */
    wait?: number;
    /** How the page behind comes in: its fade's own timing. Default the travel's. */
    appear?: Leg;
  } = {},
): Part {
  return (stage) => {
    const way = wayBackOf(stage);
    stage.appear = options.appear;
    /** The page a link back leads to, loading or loaded behind this one. */
    let loading: {
      address: string;
      frame: Promise<HTMLIFrameElement | null>;
    } | null = null;

    const dropFrame = (): void => {
      loading?.frame.then((frame) => frame?.remove());
      loading = null;
    };

    function showBehind(
      address: string,
      from: Origin,
    ): Promise<HTMLIFrameElement | null> {
      if (loading?.address !== address) {
        dropFrame();
        // Named for its scroll and for what the page will arrive with: the head script's
        // morph half, in the copy, scrolls it as soon as it is parsed, before the copy's
        // own scripts read the scroll, and publishes the rest as window.pageturn.behind.
        const frame = loadInFrame(
          address,
          // Just under the layer, above everything of the page's.
          "left:0;opacity:0;z-index:2147483646",
          `${MORPH_KEY}:${JSON.stringify({ x: from.x, y: from.y, m: way.name, d: from.d, p: from.p, ...putBackFields(from, stage.name) })}`,
        ).then((loaded) => {
          const view = loaded?.contentWindow;
          if (!loaded || !view) return null;
          view.scrollTo(from.x, from.y);
          // Scrolled as it was left, and without the element the layer travels to.
          const there = loaded.contentDocument?.querySelector<HTMLElement>(
            from.p,
          );
          if (there) there.style.visibility = "hidden";
          // Two frames: what the fonts and the scroll moved has been drawn.
          return new Promise<HTMLIFrameElement>((resolve) =>
            view.requestAnimationFrame(() =>
              view.requestAnimationFrame(() => resolve(loaded)),
            ),
          );
        });
        loading = { address, frame };
      }
      return loading.frame;
    }

    way.aims = (from, end, about) => {
      // It travels to where it started, which the way out recorded: nothing to find.
      const ends: { from: End; to: End | null } = {
        from: { ...from.e },
        to: end,
      };
      if (isDeclined(stage.morph.ends?.(ends, about))) return false;
      return { stop: ends.from, end: ends.to ?? end };
    };
    way.frameBehind = (visit, from) =>
      within(showBehind(visit.to.href, from), options.wait ?? BEHIND_WAIT_MS);
    way.dropFrame = dropFrame;
    stage.onRemove.push(
      dropFrame,
      onApproach((visit) => {
        const from = way.origin();
        if (from && way.leadsBack?.(visit)) showBehind(visit.to.href, from);
      }),
    );
  };
}
