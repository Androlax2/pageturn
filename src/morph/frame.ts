/**
 * A page loaded in a hidden frame, for `peek()` and `behind()`, and the approach of a
 * link that asks for it.
 */

import { isFocusGivenBack, reducesMotion } from "../common/page.ts";
import type { Visit } from "../kernel/core.ts";

const FRAME_STYLE =
  "position:fixed;top:0;border:0;margin:0;padding:0;max-width:none;max-height:none;pointer-events:none";

/** A page loaded in a frame the size of the window, its fonts in. Null when it cannot be read. */
export function loadInFrame(
  address: string,
  style: string,
  name = "",
): Promise<HTMLIFrameElement | null> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.name = name;
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.inert = true;
    frame.style.cssText = `${FRAME_STYLE};width:${document.documentElement.clientWidth}px;height:${innerHeight}px;${style}`;
    const fail = () => {
      frame.remove();
      resolve(null);
    };
    frame.addEventListener("error", fail);
    frame.addEventListener("load", async () => {
      try {
        await frame.contentDocument?.fonts.ready;
        if (!frame.contentDocument?.body) throw new Error("no page");
        resolve(frame);
      } catch {
        fail();
      }
    });
    frame.src = address;
    document.documentElement.append(frame);
  });
}

const INTENTS = ["pointerover", "focusin", "touchstart"];

/**
 * Calls back as a link is hovered, focused or touched. `pointerover`, not
 * `pointerenter`: it bubbles. Not for the focus the package gives back to a link on a
 * way back: that is not the visitor going to it. Returns a function that stops it.
 */
export function onApproach(tell: (visit: Visit) => void): () => void {
  // `pointerover` comes again at each child of the link: a link is told once in a row.
  let last: HTMLAnchorElement | null = null;
  const heard = (event: Event): void => {
    const link =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>("a[href]")
        : null;
    if (link === last) return;
    last = link;
    if (link && !isFocusGivenBack(link) && !reducesMotion()) {
      tell({
        link,
        via: "link",
        from: new URL(location.href),
        to: new URL(link.href),
        canHandOver: true,
      });
    }
  };
  for (const intent of INTENTS) {
    addEventListener(intent, heard, { passive: true, capture: true });
  }
  return () => {
    for (const intent of INTENTS) {
      removeEventListener(intent, heard, { capture: true });
    }
  };
}
