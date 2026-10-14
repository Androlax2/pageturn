/** The core's kind, `picture`: what a morph is made of when it says no other. */
import { within } from "./end.ts";
import {
  CONTENT_STYLE,
  centredOn,
  cloned,
  LAYER_STYLE,
  sizeOf,
} from "./layer.ts";
import type { Kind } from "./types.ts";

/** How long the real picture may take to draw before the layer is swapped for it. */
const PICTURE_WAIT_MS = 250;

/** What the core draws the picture's way, cropped: anything else is laid out whole. */
const MEDIA = "img,video,canvas";

/** The picture of an element, drawn; resolves at once when it has none. */
export async function whenDrawn(element: Element): Promise<void> {
  const picture = element.matches("img")
    ? element
    : element.querySelector("img");
  if (picture instanceof HTMLImageElement) {
    await within(picture.decode(), PICTURE_WAIT_MS).catch(() => {});
  }
}

/**
 * What a picture shows now, drawn again to cover a box of that size. It needs no file:
 * a copy of a picture asks for its file again, and may wait for it; this is on the
 * screen at once, behind the copy, until the copy has drawn.
 */
function snapshot(
  shown: HTMLImageElement,
  width: number,
  height: number,
  position: string,
): HTMLCanvasElement | null {
  const { naturalWidth, naturalHeight } = shown;
  if (!shown.complete || !naturalWidth || !naturalHeight) return null;
  const canvas = document.createElement("canvas");
  const cover = Math.max(width / naturalWidth, height / naturalHeight);
  const across = width / cover;
  const down = height / cover;
  // `object-position` in percentages; anything else is read as the centre.
  const [x = 0.5, y = 0.5] = position
    .split(" ")
    .map((share) =>
      share.endsWith("%") ? Number.parseFloat(share) / 100 : 0.5,
    );
  canvas.width = Math.round(across);
  canvas.height = Math.round(down);
  try {
    canvas
      .getContext("2d")
      ?.drawImage(
        shown,
        (naturalWidth - across) * x,
        (naturalHeight - down) * y,
        across,
        down,
        0,
        0,
        canvas.width,
        canvas.height,
      );
  } catch {
    // A picture from another origin, served without CORS: it cannot be drawn again.
    return null;
  }
  canvas.dataset.turnShot = "";
  canvas.style.cssText =
    "position:absolute;left:0;top:0;width:100%;height:100%;z-index:-1";
  return canvas;
}

/** The picture an element is, or the one picture it holds. */
function pictureOf(element: Element): Element | null {
  const inside = element.querySelectorAll(MEDIA);
  return element.matches(MEDIA)
    ? element
    : inside.length === 1
      ? (inside[0] as Element)
      : null;
}

/**
 * The core's kind. The element, or the one picture it holds, laid out at the size of
 * the end it goes to, so that its last frame is not transformed; never stretched: it
 * covers each end, and the layer is cropped to it.
 */
export const picture: Kind = {
  read(element, end) {
    // A frame may hold its picture larger than itself (a hover's zoom, a parallax's
    // margin), differently at each end: read, so that the layer's picture is held too.
    const inner = pictureOf(element);
    if (!inner || inner === element) return;
    const style = getComputedStyle(inner);
    const own = new DOMMatrix(style.transform);
    const zoom =
      Math.hypot(own.a, own.b) * (Number.parseFloat(style.scale) || 1);
    if (Math.abs(zoom - 1) > 0.001) end.zoom = zoom;
  },
  build(element, from, to) {
    const layer = document.createElement("div");
    const media = pictureOf(element);
    const content = cloned(
      media ? (media.closest("picture") ?? media) : element,
    );
    const drawn = content.matches(MEDIA)
      ? content
      : ((media && content.querySelector<HTMLElement>(MEDIA)) ?? content);
    if (drawn !== content) content.style.cssText = "display:contents";
    content.dataset.turnContent = "";
    drawn.style.cssText += `;display:block;width:100%;height:100%;${CONTENT_STYLE}`;
    if (media) {
      drawn.style.objectFit = "cover";
      drawn.style.objectPosition = getComputedStyle(media).objectPosition;
    }
    const { width, height } = (to ?? from).box;
    layer.style.cssText = `${LAYER_STYLE};width:${width}px;height:${height}px`;
    layer.append(content);
    if (
      drawn instanceof HTMLImageElement &&
      media instanceof HTMLImageElement
    ) {
      // A copy above the page is never "near the viewport" to a lazy picture: it would wait.
      drawn.loading = "eager";
      drawn.decoding = "sync";
      // The file the page has drawn: what the layer crosses with if it gets no other.
      drawn.dataset.turnFile = media.currentSrc;
      if (to) {
        // The file its place needs. What is drawn now stays under it until it has come.
        const sizes = to.sizes ?? `${Math.ceil(width)}px`;
        for (const sized of layer.querySelectorAll<
          HTMLImageElement | HTMLSourceElement
        >("img[srcset],source[srcset]")) {
          sized.sizes = sizes;
        }
      }
      const shot = snapshot(media, width, height, drawn.style.objectPosition);
      if (shot) {
        layer.append(shot);
        // Once the copy has its file and has drawn it, what stood in for it goes.
        const drew = (): void => {
          drawn.decode().then(
            () => shot.remove(),
            () => {},
          );
        };
        if (drawn.complete && drawn.naturalWidth) drew();
        else drawn.addEventListener("load", drew, { once: true });
      }
    }
    return layer;
  },
  pose(layer) {
    const [width, height] = sizeOf(layer);
    const held =
      layer.querySelector<HTMLElement>(MEDIA) ??
      (layer.firstElementChild as HTMLElement);
    // Scaled to cover the end's box, then cropped to it: never stretched. The crop and
    // the corners are written at the layer's own size, since the scale applies to them.
    return ({ box, rotate = 0, radius, zoom = 1 }) => {
      const cover = Math.max(box.width / width, box.height / height);
      return {
        move: {
          translate: centredOn(box, width, height),
          rotate: `${rotate}deg`,
          scale: `${cover}`,
        },
        look: {
          clipPath: `inset(${(height - box.height / cover) / 2}px ${(width - box.width / cover) / 2}px round ${radius / cover}px)`,
        },
        on: layer,
        inner: { look: { scale: `${zoom}` }, on: held },
      };
    };
  },
  fit(layer, to) {
    layer.style.width = `${to.box.width}px`;
    layer.style.height = `${to.box.height}px`;
  },
};
