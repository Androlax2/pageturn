/** The `copy()` part of pageturn/morph. */
import {
  CONTENT_STYLE,
  centredOn,
  cloned,
  LAYER_STYLE,
  sizeOf,
} from "./layer.ts";
import type { Kind } from "./types.ts";

/**
 * The layer is a copy of the element at its own size, with what it contains: a card, a
 * button. It is stretched from one end's box to the other's, corners included.
 */
export function copy(): Kind {
  return {
    build(element) {
      const layer = document.createElement("div");
      const content = cloned(element);
      const own = element as HTMLElement;
      // Its own size, untransformed; the drawn one when it has none (an SVG element).
      const drawn =
        own.offsetWidth && own.offsetHeight
          ? null
          : element.getBoundingClientRect();
      const width = own.offsetWidth || (drawn?.width ?? 0);
      const height = own.offsetHeight || (drawn?.height ?? 0);
      content.style.cssText += `;width:${width}px;height:${height}px;${CONTENT_STYLE}`;
      content.dataset.turnContent = "";
      layer.style.cssText = `${LAYER_STYLE};width:${width}px;height:${height}px`;
      layer.append(content);
      return layer;
    },
    pose(layer) {
      const [width, height] = sizeOf(layer);
      return ({ box, rotate = 0, radius }) => {
        const x = box.width / width;
        const y = box.height / height;
        return {
          move: {
            translate: centredOn(box, width, height),
            rotate: `${rotate}deg`,
            scale: `${x} ${y}`,
          },
          look: { borderRadius: `${radius / x}px / ${radius / y}px` },
          on: layer.firstElementChild as HTMLElement,
        };
      };
    },
  };
}
