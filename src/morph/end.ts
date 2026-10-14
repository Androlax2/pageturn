/**
 * Reading an element as an end of a travel, and comparing two ends.
 */
import type { End } from "./place.ts";

export const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/** What the promise answers, or null when it has not answered in that long. */
export const within = <T>(
  promise: T | Promise<T>,
  milliseconds: number,
): Promise<T | null> =>
  Promise.race([promise, wait(milliseconds).then(() => null)]);

/** An animation that ends: an infinite one would be waited for forever. */
export const isEnding = (animation: Animation): boolean =>
  Number.isFinite(animation.effect?.getComputedTiming().endTime);

/**
 * An element's corner radius, in pixels, for a box that wide: a percentage is of its
 * width; a length is drawn at the scale the element is held at.
 */
export function radiusOf(element: Element, width: number, scale = 1): number {
  const corner = getComputedStyle(element).borderTopLeftRadius;
  const radius = Number.parseFloat(corner) || 0;
  return corner.includes("%") ? (radius / 100) * width : radius * scale;
}

/** An element measured as an end: the rectangle it is drawn in, and its corners. */
export function endOf(element: Element): End {
  const { left, top, width, height } = element.getBoundingClientRect();
  const end: End = {
    box: { left, top, width, height },
    radius: radiusOf(element, width),
  };
  const picture = (
    element.matches("img") ? element : element.querySelector("img")
  ) as HTMLImageElement | null;
  if (picture?.sizes) end.sizes = picture.sizes;
  return end;
}

export const shifted = (end: End, x: number, y: number): End => ({
  ...end,
  box: { ...end.box, left: end.box.left + x, top: end.box.top + y },
});

/**
 * Two ends a layer would be drawn the same at, to the pixel. By what is drawn, not by
 * what is written: an end with no `rotate` and one with `rotate: 0` are the same.
 */
export const looksSame = (one: End, other: End): boolean => {
  const drawn = (end: End): number[] => [
    end.box.left,
    end.box.top,
    end.box.width,
    end.box.height,
    end.radius,
    end.rotate ?? 0,
    end.text?.box.left ?? 0,
    end.text?.box.top ?? 0,
    Number.parseFloat(end.text?.type.fontSize ?? "0"),
  ];
  const others = drawn(other);
  return (
    drawn(one).every(
      (value, index) => Math.abs(value - (others[index] ?? 0)) < 0.5,
    ) &&
    one.text?.color === other.text?.color &&
    one.background === other.background
  );
};

/** Reads something with these animations at their end, and puts them back as they were. */
export function atTheirEnd<T>(animations: Animation[], read: () => T): T {
  const held = animations.filter(isEnding);
  const times = held.map((animation) => animation.currentTime);
  for (const animation of held) {
    animation.currentTime = animation.effect?.getComputedTiming()
      .endTime as number;
  }
  try {
    return read();
  } finally {
    held.forEach((animation, index) => {
      animation.currentTime = times[index] ?? null;
    });
  }
}
