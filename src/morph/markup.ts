/**
 * pageturn/morph/markup: a morph from the markup. `data-turn-morph="product"` on the
 * element that travels and on the one it becomes, and nothing else: it grows into the
 * next page, and back into its place on the browser's Back. Imported for its effect.
 *
 * One morph per name found on the page. The element that travels is the one with the
 * name inside the clicked link, or the link itself, or around it: a list of cards can
 * all say `product`, the click says which. On the page reached, it lands on the first
 * element with the name. Found where it was last seen (`seen()`), and played back on
 * Back (`back()`). A name the site defines itself with defineMorph is left to it.
 */
import { afterDomContentLoaded, inBrowser } from "../common/page.ts";
import { back } from "./back.ts";
import { defineMorph, isDefined } from "./define.ts";
import { seen } from "./finders.ts";

const ATTRIBUTE = "data-turn-morph";

/** Defines a morph for each name the page's markup gives that no defineMorph took. */
function morphsFromMarkup(): void {
  const names = new Set(
    [...document.querySelectorAll(`[${ATTRIBUTE}]`)].map(
      (element) => element.getAttribute(ATTRIBUTE) ?? "",
    ),
  );
  for (const name of names) {
    if (!name || isDefined(name)) continue;
    const selector = `[${ATTRIBUTE}="${CSS.escape(name)}"]`;
    defineMorph(name, {
      from: (link) => link.querySelector(selector) ?? link.closest(selector),
      to: selector,
      find: seen(),
      use: [back()],
    });
  }
}

// Once every module of the page has run, so that a defineMorph of the same name, in
// the site's own module, is there first.
if (inBrowser) afterDomContentLoaded(morphsFromMarkup);
