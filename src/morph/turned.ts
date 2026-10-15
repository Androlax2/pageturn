/** The `turned()` part of pageturn/morph. */
import { endOf, ownCorners } from "./end.ts";
import type { Part } from "./types.ts";

/** The rotation and scale of a style's own transforms, as a matrix. */
function ownTransform(style: CSSStyleDeclaration): DOMMatrix {
  const [x = 1, y = x] = style.scale.split(" ").map(Number.parseFloat);
  return new DOMMatrix()
    .rotate(Number.parseFloat(style.rotate) || 0)
    .scale(x || 1, y || 1)
    .multiply(new DOMMatrix(style.transform));
}

/**
 * Reads an element that is turned when it is clicked (a tilted card, a hover that
 * leans): around the centre it is seen at, with the rotation and the scale it and its
 * ancestors hold. Without it the morph reads the rectangle around the element, which is
 * larger than a turned element.
 */
export function turned(): Part {
  return (stage) => {
    stage.endOf = (element) => {
      const end = endOf(element);
      let matrix = new DOMMatrix();
      for (
        let node: Element | null = element;
        node;
        node = node.parentElement
      ) {
        matrix = ownTransform(getComputedStyle(node)).multiply(matrix);
      }
      const rotate = (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
      const scaleX = Math.hypot(matrix.a, matrix.b);
      // Not turned, the rectangle is exact to the fraction of a pixel, which offsetWidth
      // is not. Turned, it is the box around the element, larger than it.
      // Read by its properties, not its class: the element may be in another document.
      const own = element as HTMLElement;
      const isTurned = Math.abs(rotate) > 0.01 && own.offsetWidth > 0;
      const { box } = end;
      const width = isTurned ? own.offsetWidth * scaleX : box.width;
      const height = isTurned
        ? own.offsetHeight * Math.hypot(matrix.c, matrix.d)
        : box.height;
      return {
        ...end,
        box: {
          left: box.left + (box.width - width) / 2,
          top: box.top + (box.height - height) / 2,
          width,
          height,
        },
        rotate,
        radius: ownCorners(getComputedStyle(element), width, scaleX),
      };
    };
  };
}
