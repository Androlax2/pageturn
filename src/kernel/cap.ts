/**
 * The kernel's waits on animations: how long one may last, and the wait itself.
 */

/**
 * How long a wait may last: the CSS time a site sets as `property` on <html>
 * (`--turn-leave-max`, `--turn-arrive-max`), in ms, and never more than `ceiling`.
 */
export function capOf(property: string, ceiling: number): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(
    property,
  );
  const max = Number.parseFloat(value) * (/ms\s*$/.test(value) ? 1 : 1000);
  return max >= 0 ? Math.min(max, ceiling) : ceiling;
}

/** An animation that ends: an infinite one would be waited for forever. */
export const isEnding = (animation: Animation): boolean =>
  animation.effect?.getTiming().iterations !== Infinity;

/** Resolves when these animations have all ended, or in that long at the latest. */
export const untilEnded = (
  animations: Animation[],
  milliseconds: number,
): Promise<unknown> =>
  Promise.race([
    Promise.allSettled(animations.map((animation) => animation.finished)),
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ]);
