/** The `text()` part of pageturn/morph. */

import { atTheirEnd, cornersCss, ownCorners } from "./end.ts";
import { LAYER_STYLE } from "./layer.ts";
import type { Box, End } from "./place.ts";
import { over } from "./timing.ts";
import type { Kind } from "./types.ts";

/** What the words are set in and goes from one end's to the other's on the way. */
const TYPE = [
  "fontSize",
  "fontWeight",
  "fontStretch",
  "letterSpacing",
  "fontVariationSettings",
] as const;

/** What the words are set in and does not change on the way. */
const FACE = [
  "fontFamily",
  "fontStyle",
  "textTransform",
  "fontKerning",
  "fontFeatureSettings",
] as const;

/** Where the glyphs of an element are drawn. */
function glyphs(element: Element): Box {
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  const { left, top, width, height } = range.getBoundingClientRect();
  return { left, top, width, height };
}

/** How the part of the words that changes between the two ends leaves and arrives. */
export interface Swap {
  /** The word of the end the travel starts from. Default: it fades out. */
  leave?: Keyframe[];
  /** The word of the end it stops at. Default: it fades in. */
  arrive?: Keyframe[];
  /** Default: the travel's own. */
  duration?: number;
  delay?: number;
  easing?: string;
  /** A `clip-path` for the place the two words pass through: a word that rolls in. */
  clip?: string;
}

type Pseudo = "::before" | "::after";

export interface TextOptions {
  /**
   * The box that travels behind the words, when it is not the element's own: a
   * pseudo-element of it, "::before" or "::after", read where the element is measured.
   * It has to exist there (`content`), absolutely placed in the element. Said for both
   * ends, or for one: `{ to: "::before" }` when only the element landed on draws its box
   * that way, and the one that travels has a pseudo-element for something else.
   */
  box?: Pseudo | { from?: Pseudo; to?: Pseudo };
  /**
   * When the two ends do not say the same thing: what they share stays, and this says
   * how the part that differs changes. Given the way it plays, for each direction its own.
   */
  swap?: Swap | ((about: { back: boolean }) => Swap);
}

/** Two texts as what they share and what differs between them. */
function splitDifference(
  one: string,
  other: string,
): [string, string, string, string] {
  const least = Math.min(one.length, other.length);
  let head = 0;
  while (head < least && one[head] === other[head]) head++;
  let tail = 0;
  while (
    tail < least - head &&
    one[one.length - 1 - tail] === other[other.length - 1 - tail]
  ) {
    tail++;
  }
  return [
    one.slice(0, head),
    one.slice(head, one.length - tail),
    other.slice(head, other.length - tail),
    other.slice(other.length - tail),
  ];
}

/**
 * The layer is the words, set again as real text at every size instead of a copy being
 * stretched: their size, weight, tracking and colour go from one end's to the other's.
 * The element's own box travels behind them, with its fill and its corners: a button's
 * pill becomes whatever box the title has, or fades out to none. When the two ends do
 * not say the same thing, what they share stays and the rest changes on the way.
 */
export function text(options: TextOptions = {}): Kind {
  const pseudoOf = (isTo: boolean): Pseudo | undefined =>
    typeof options.box === "object"
      ? options.box[isTo ? "to" : "from"]
      : options.box;
  const part = (layer: Element, name: string): HTMLElement =>
    layer.querySelector(`[data-turn-part="${name}"]`) as HTMLElement;
  return {
    read(element, end, isTo) {
      const style = getComputedStyle(element);
      const type: Record<string, string> = {};
      for (const property of TYPE) type[property] = style[property];
      // "normal" cannot be animated to a length: the tracking would jump half way.
      if (type.letterSpacing === "normal") type.letterSpacing = "0px";
      // The optical size the words are drawn at: the one their style names, or their own.
      if (type.fontVariationSettings === "normal") {
        type.fontVariationSettings = `"opsz" ${Number.parseFloat(style.fontSize)}`;
      }
      let box = glyphs(element);
      const words = (element.textContent ?? "").replace(/\s+/g, " ").trim();
      end.background = style.backgroundColor;
      if (element.getClientRects().length === 0) {
        // Not laid out (a step that is not shown): its words are set in a hidden copy,
        // for their size. Their place is the screen's corner, for the site to give.
        const copy = document.createElement("span");
        copy.style.cssText =
          "position:fixed;left:0;top:0;white-space:nowrap;line-height:1;font-optical-sizing:none;visibility:hidden";
        for (const property of FACE) copy.style[property] = style[property];
        Object.assign(copy.style, type);
        copy.textContent = words;
        document.documentElement.append(copy);
        box = glyphs(copy);
        copy.remove();
        end.box = { ...box };
      } else if (pseudoOf(isTo)) {
        // A box the page draws by a pseudo-element: where its own styles put it, in the
        // element's padding box. Without one there, the element's own box stands.
        const drawn = getComputedStyle(element, pseudoOf(isTo));
        const [left, top, width, height] = [
          drawn.left,
          drawn.top,
          drawn.width,
          drawn.height,
        ].map(Number.parseFloat);
        if (
          drawn.content !== "none" &&
          [left, top, width, height].every(Number.isFinite)
        ) {
          const own = element.getBoundingClientRect();
          end.box = {
            left: own.left + element.clientLeft + (left ?? 0),
            top: own.top + element.clientTop + (top ?? 0),
            width: width ?? 0,
            height: height ?? 0,
          };
          end.radius = ownCorners(drawn, width ?? 0);
          end.background = drawn.backgroundColor;
        }
      }
      end.text = {
        box,
        type,
        color: style.color,
        words,
      };
    },
    build(element, from) {
      const layer = document.createElement("div");
      const content = document.createElement("span");
      const fill = document.createElement("span");
      const style = getComputedStyle(element);
      const type = from.text?.type ?? {};
      // The optical size is the one `read` wrote in the variation settings, animated with
      // them: the browser choosing one at each size would make the glyphs jump.
      layer.style.cssText = `${LAYER_STYLE};width:0;height:0;white-space:nowrap;line-height:1;font-optical-sizing:none`;
      for (const property of FACE) layer.style[property] = style[property];
      Object.assign(layer.style, type);
      content.style.cssText = "position:absolute;left:0;top:0";
      content.textContent = from.text?.words ?? "";
      content.dataset.turnContent = "";
      content.dataset.turnWords = "";
      fill.style.cssText = "position:absolute;z-index:-1";
      fill.dataset.turnBox = "";
      layer.append(content, fill);
      return layer;
    },
    pose(layer) {
      const fill = layer.lastElementChild as HTMLElement;
      /**
       * How far inside the layer words are drawn, in a type. Measured in each end's own
       * type, on a copy of the layer: it is not the same share of every size (a font's
       * line is fitted to whole pixels), and a pixel at the title's size is seen.
       */
      const insetOf = (words: NonNullable<End["text"]>): [number, number] => {
        const probe = layer.cloneNode(false) as HTMLElement;
        const line = document.createElement("span");
        probe.removeAttribute("popover");
        // Not a layer: a site that counts them must not count this.
        delete probe.dataset.turnLayer;
        Object.assign(probe.style, words.type, {
          translate: "none",
          rotate: "none",
          visibility: "hidden",
        });
        line.style.cssText = "position:absolute;left:0;top:0";
        line.textContent = words.words;
        probe.append(line);
        document.documentElement.append(probe);
        const corner = probe.getBoundingClientRect();
        const drawn = glyphs(line);
        probe.remove();
        return [drawn.left - corner.left, drawn.top - corner.top];
      };
      return ({ text: words, rotate = 0, box, radius, background }: End) => {
        if (!words) throw new Error("pageturn/morph: an end has no text");
        const [x, y] = insetOf(words);
        const left = words.box.left - x;
        const top = words.box.top - y;
        return {
          // By a translation, not `left` and `top`: Safari does not show those travel.
          move: { translate: `${left}px ${top}px`, rotate: `${rotate}deg` },
          look: {
            ...words.type,
            color: words.color,
            // Around the middle of its box: a site that scales the layer (a button that
            // gives under the press) scales it around what is seen.
            transformOrigin: `${box.left - left + box.width / 2}px ${box.top - top + box.height / 2}px`,
          },
          on: layer,
          // The element's own box behind its words: a button's pill, a title's band. In
          // pixels: a length in em inside a keyframe is not read at the animated font
          // size by every browser.
          inner: {
            on: fill,
            look: {
              left: `${box.left - left}px`,
              top: `${box.top - top}px`,
              width: `${box.width}px`,
              height: `${box.height}px`,
              borderRadius: cornersCss(radius),
              backgroundColor: background ?? "transparent",
            },
          },
        };
      };
    },
    play(layer, start, stop, timing, back) {
      const content = layer.firstElementChild as HTMLElement;
      const [from, to] = [start.text?.words ?? "", stop.text?.words ?? ""];
      // The same words at both ends, or already split by the travel before this one.
      if (from === to || !to || content.firstElementChild) return;
      const [head, leaving, arriving, rest] = splitDifference(from, to);
      const swap =
        (typeof options.swap === "function"
          ? options.swap({ back })
          : options.swap) ?? {};
      const span = (name: string, words: string, style: string): string =>
        `<span data-turn-part="${name}" style="${style}">${words.replace(/[&<]/g, (sign) => (sign === "&" ? "&amp;" : "&lt;"))}</span>`;
      // The word of the end it stops at is in the flow: its place is as wide as it. The
      // other lies over it, and what follows can slide.
      content.innerHTML =
        span("head", head, "") +
        `<span style="position:relative;display:inline-block">${span("arriving", arriving, "display:inline-block")}${span("leaving", leaving, "position:absolute;left:0;top:0")}</span>` +
        `<span data-turn-part="fit" style="display:inline-block">${span("rest", rest, "display:inline-block;white-space:pre")}</span>`;
      const [fit, restPart, leavingPart, arrivingPart] = [
        "fit",
        "rest",
        "leaving",
        "arriving",
      ].map((name) => part(layer, name)) as HTMLElement[];
      const slot = arrivingPart?.parentElement as HTMLElement;
      if (swap.clip) slot.style.clipPath = swap.clip;
      const widthOf = (element: HTMLElement | undefined): number =>
        element?.getBoundingClientRect().width ?? 0;
      /**
       * How much narrower the leaving word is than the place kept for the arriving one,
       * as a share of the width of what follows, which a translation in percent is
       * counted in: a length in em inside a keyframe is not read at the animated size by
       * every browser. Not the same share in each type: measured in both.
       */
      const shareToClose = (): number =>
        (100 * (widthOf(arrivingPart) - widthOf(leavingPart))) /
        (widthOf(restPart) || 1);
      const atStart = shareToClose();
      const atStop = atTheirEnd(layer.getAnimations(), shareToClose);
      const swapTiming = over(timing, swap);
      // What follows keeps to the leaving word for the whole travel, and is let go as
      // the arriving word takes its place.
      fit?.animate({ translate: [`${-atStart}% 0`, `${-atStop}% 0`] }, timing);
      restPart?.animate({ translate: ["0% 0", `${atStop}% 0`] }, swapTiming);
      leavingPart?.animate(
        swap.leave ?? [{ opacity: 1 }, { opacity: 0 }],
        swapTiming,
      );
      arrivingPart?.animate(
        swap.arrive ?? [{ opacity: 0 }, { opacity: 1 }],
        swapTiming,
      );
    },
  };
}
