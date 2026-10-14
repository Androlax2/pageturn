/**
 * The layer: what travels in place of the element, styled inline so that nothing
 * depends on the site's stylesheet, and written as markup to cross the page change.
 */
import type { Box, End } from "./place.ts";
import type { Kind, Pose } from "./types.ts";

/** Undoes what a popover looks like by default, and what a site's rules could add. */
export const LAYER_STYLE =
  "position:fixed;inset:auto;left:0;top:0;margin:0;border:0;padding:0;overflow:visible;background:none;color:inherit;pointer-events:none;z-index:2147483647;transform-origin:50% 50%;max-width:none;max-height:none";

/** Undoes what the element had from its place in the page: margins, limits, its own transforms. */
export const CONTENT_STYLE =
  "margin:0;max-width:none;max-height:none;box-sizing:border-box;visibility:visible;translate:none;rotate:none;scale:none;transform:none";

/** A copy of an element for a layer: nothing of it answers to a name any more. */
export function cloned(element: Element): HTMLElement {
  const copy = element.cloneNode(true) as HTMLElement;
  for (const named of [copy, ...copy.querySelectorAll("[id]")]) {
    named.removeAttribute("id");
  }
  return copy;
}

/** A layer's own size, as its kind laid it out. */
export const sizeOf = (layer: HTMLElement): [number, number] => [
  Number.parseFloat(layer.style.width),
  Number.parseFloat(layer.style.height),
];

/** Where a layer that size stands so that its middle is the box's: what it scales around. */
export const centredOn = (box: Box, width: number, height: number): string =>
  `${box.left + (box.width - width) / 2}px ${box.top + (box.height - height) / 2}px`;

/** What the layer itself is animated by at an end: where it is, and how much it shows. */
export const moveAt = (pose: Pose, end: End): Keyframe => ({
  ...pose.move,
  opacity: end.opacity ?? 1,
});

/** Puts a layer at an end at once, with no animation: where it starts, or where it was handed over. */
export function standAt(layer: HTMLElement, kind: Kind, end: End): void {
  const pose = kind.pose(layer)(end);
  Object.assign(layer.style, moveAt(pose, end));
  Object.assign(pose.on.style, pose.look);
  if (pose.inner) Object.assign(pose.inner.on.style, pose.inner.look);
}

/**
 * A layer as markup, to cross a page change. Its styles are kept apart from `style`,
 * which a strict policy drops from parsed markup; its pictures keep the file they were
 * drawing, which the page reached has, and ask for no other.
 */
export function markup(layer: HTMLElement): string {
  const copy = layer.cloneNode(true) as HTMLElement;
  for (const shot of copy.querySelectorAll("[data-turn-shot]")) shot.remove();
  const drawn = layer.querySelectorAll("img");
  copy.querySelectorAll("img").forEach((picture, index) => {
    const live = drawn[index];
    const file =
      live?.complete && live.naturalWidth
        ? live.currentSrc
        : picture.dataset.turnFile;
    if (!file) return;
    picture.src = file;
    picture.removeAttribute("srcset");
    picture.removeAttribute("sizes");
    for (const source of picture.parentElement?.querySelectorAll("source") ??
      []) {
      source.remove();
    }
  });
  for (const styled of [
    copy,
    ...copy.querySelectorAll<HTMLElement>("[style]"),
  ]) {
    styled.dataset.turnStyle = styled.style.cssText;
    styled.removeAttribute("style");
  }
  return copy.outerHTML;
}
