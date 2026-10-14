/**
 * pageturn/testing: what a browser test needs to look at a morph's travel without
 * reading how its layer is built. Written for Playwright, and bound to nothing: `page` is
 * anything with `locator` and `evaluate` of that shape.
 */

/** As much of a Playwright page as these helpers use. */
export interface PageLike<Locator> {
  locator(selector: string): Locator;
  evaluate<Result, Argument>(
    run: (argument: Argument) => Result | Promise<Result>,
    argument: Argument,
  ): Promise<Result>;
}

const LAYER = "[data-turn-layer]";
/**
 * Everything a travel animates: the layer and the shape under it. Passed into the page,
 * where the module's constants are not.
 */
const PARTS = `${LAYER}, [data-turn-shadow]`;

/** The layer a morph travels on, and its parts by name. */
export function layer<Locator>(page: PageLike<Locator>): {
  /** The layer itself: what the package moves. */
  root: Locator;
  /** What it shows: the picture, the copy, or the words. */
  content: Locator;
  /** text(): the words. */
  words: Locator;
  /** text(): the box behind the words. */
  box: Locator;
  /** text(), when the two ends differ: "head", "leaving", "arriving" or "rest". */
  part(name: "head" | "leaving" | "arriving" | "rest"): Locator;
  /** shadow(): the shape that casts the shadow under the layer. */
  shadow: Locator;
} {
  return {
    root: page.locator(LAYER),
    content: page.locator(`${LAYER} [data-turn-content]`),
    words: page.locator(`${LAYER} [data-turn-words]`),
    box: page.locator(`${LAYER} [data-turn-box]`),
    part: (name) => page.locator(`${LAYER} [data-turn-part="${name}"]`),
    shadow: page.locator("[data-turn-shadow]"),
  };
}

/**
 * Holds the travel at a time, in milliseconds from its start, its delay included: every
 * animation of the layer and of what follows it. Answers false when no layer is there.
 */
export function seekTravel<Locator>(
  page: PageLike<Locator>,
  time: number,
): Promise<boolean> {
  return page.evaluate(
    ({ at, selector }) => {
      const parts = document.querySelectorAll(selector);
      for (const part of parts) {
        for (const animation of part.getAnimations({ subtree: true })) {
          animation.pause();
          animation.currentTime = at;
        }
      }
      return parts.length > 0;
    },
    { at: time, selector: PARTS },
  );
}

/** Lets a travel held by seekTravel go on from where it is. */
export function resumeTravel<Locator>(page: PageLike<Locator>): Promise<void> {
  return page.evaluate((selector) => {
    for (const part of document.querySelectorAll(selector)) {
      for (const animation of part.getAnimations({ subtree: true })) {
        animation.play();
      }
    }
  }, PARTS);
}

/**
 * Brings the travel to its last frame and holds it there: the layer as it is just before
 * the page changes or the layer is swapped. Answers false when no layer is there.
 */
export function endTravel<Locator>(page: PageLike<Locator>): Promise<boolean> {
  return page.evaluate((selector) => {
    const parts = document.querySelectorAll(selector);
    for (const part of parts) {
      for (const animation of part.getAnimations({ subtree: true })) {
        const end = animation.effect?.getComputedTiming().endTime;
        if (Number.isFinite(Number(end))) {
          animation.pause();
          animation.currentTime = Number(end);
        }
      }
    }
    return parts.length > 0;
  }, PARTS);
}
