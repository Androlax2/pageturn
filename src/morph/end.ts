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

/** The four corners of an end: top-left, top-right, bottom-right, bottom-left. */
export type Corners = readonly [number, number, number, number];

const CORNERS = ["TopLeft", "TopRight", "BottomRight", "BottomLeft"] as const;

/** An end's corners, four of them, whether it says one radius for all or four. */
export const cornersOf = (radius: number | Corners): Corners =>
  typeof radius === "number" ? [radius, radius, radius, radius] : radius;

/** One radius when the four corners agree, the four otherwise: an end stays plain. */
const radiusOf = (corners: Corners): number | Corners =>
  corners.every((corner) => corner === corners[0]) ? corners[0] : corners;

/**
 * The corners a style draws, in pixels, for a box that wide: a percentage is of its
 * width; a length is drawn at the scale the element is held at.
 */
export function ownCorners(
  style: CSSStyleDeclaration,
  width: number,
  scale = 1,
): number | Corners {
  return radiusOf(
    CORNERS.map((corner) => {
      const value = style[`border${corner}Radius`];
      const radius = Number.parseFloat(value) || 0;
      return value.includes("%") ? (radius / 100) * width : radius * scale;
    }) as unknown as Corners,
  );
}

/** An end's corners as CSS writes them, each divided by the scale the layer is held at. */
export const cornersCss = (radius: number | Corners, scale = 1): string =>
  cornersOf(radius)
    .map((corner) => `${corner / scale}px`)
    .join(" ");

/**
 * An element's corners as they are seen: its own, or rounder where an ancestor that
 * clips it (a card with `overflow: hidden`) has its corner on the element's. That
 * ancestor clips at its padding edge, inside its border, where its radius is smaller.
 */
function seenCorners(element: Element, box: DOMRect): number | Corners {
  const corners = [
    ...cornersOf(ownCorners(getComputedStyle(element), box.width)),
  ];
  const near = (one: number, other: number): boolean =>
    Math.abs(one - other) < 1;
  for (
    let clip = element.parentElement;
    clip && clip !== document.body;
    clip = clip.parentElement
  ) {
    const style = getComputedStyle(clip);
    if (
      style.overflow === "visible" &&
      !/paint|strict|content/.test(style.contain)
    ) {
      continue;
    }
    const edge = clip.getBoundingClientRect();
    const left = edge.left + clip.clientLeft;
    const top = edge.top + clip.clientTop;
    const right = near(box.right, left + clip.clientWidth);
    const bottom = near(box.bottom, top + clip.clientHeight);
    const atLeft = near(box.left, left);
    const atTop = near(box.top, top);
    const radii = cornersOf(ownCorners(style, edge.width));
    const border = Math.max(clip.clientLeft, clip.clientTop);
    [
      atLeft && atTop,
      right && atTop,
      right && bottom,
      atLeft && bottom,
    ].forEach((meets, index) => {
      if (meets) {
        corners[index] = Math.max(
          corners[index] ?? 0,
          (radii[index] ?? 0) - border,
        );
      }
    });
  }
  return radiusOf(corners as unknown as Corners);
}

/** An element measured as an end: the rectangle it is drawn in, and its corners as seen. */
export function endOf(element: Element): End {
  const rect = element.getBoundingClientRect();
  const { left, top, width, height } = rect;
  const end: End = {
    box: { left, top, width, height },
    radius: seenCorners(element, rect),
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
    ...cornersOf(end.radius),
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
