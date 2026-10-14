/** The `peek()` part of pageturn/morph. */
import { isEnding, within } from "./end.ts";
import { loadInFrame, onApproach } from "./frame.ts";
import type { End } from "./place.ts";
import type { Finder } from "./types.ts";

/** How long the click waits for the destination to be measured, in ms. */
const PEEK_WAIT_MS = 1500;

/**
 * Looks at the destination: loads it in a hidden frame, its own animations over, and
 * measures the element there. Asked for as a link of the morph is hovered, focused or
 * touched (`warm`), kept per address and window size, and waited for `wait` milliseconds
 * at most at the click.
 */
export function peek(options: { wait?: number; warm?: boolean } = {}): Finder {
  const asked = new Map<string, Promise<End | null>>();
  const measureThere: Finder = (to, selector, measure) => {
    const key = `${to.href} ${selector} ${innerWidth}x${innerHeight}`;
    let answer = asked.get(key);
    if (!answer) {
      answer = loadInFrame(to.href, "left:-200vw;visibility:hidden").then(
        (frame) => {
          const page = frame?.contentDocument;
          const element = page?.querySelector(selector);
          // Measured as it will be once arrived: its entrance played to its end.
          for (const animation of page?.getAnimations() ?? []) {
            if (isEnding(animation)) animation.finish();
          }
          const end = element ? measure(element) : null;
          frame?.remove();
          // A page without the element is asked for again at the next approach.
          if (!end) asked.delete(key);
          return end;
        },
      );
      asked.set(key, answer);
    }
    return answer;
  };
  const finder: Finder = (to, selector, measure) =>
    within(measureThere(to, selector, measure), options.wait ?? PEEK_WAIT_MS);
  if (options.warm ?? true) {
    finder.start = (stage) => {
      stage.onRemove.push(
        onApproach((visit) => {
          const { match, from } = stage.morph;
          if (match ? match(visit) : from?.(visit.link)) {
            measureThere(visit.to, stage.morph.to, stage.read);
          }
        }),
      );
    };
  }
  return finder;
}
