/**
 * pageturn/turbo: pageturn's moves on Turbo Drive's visits, the links and forms Turbo
 * handles without loading a page. Imported for its effect, beside Turbo:
 *
 *   import "@hotwired/turbo";
 *   import "pageturn/turbo";
 *
 * The kernel comes with it (pageturn/core), for the links Turbo leaves to the browser
 * (`data-turbo="false"`). The head script goes first in every page's <head>, as without
 * Turbo; Turbo keeps it across visits.
 */
import { inBrowser } from "../common/page.ts";
import "../kernel/core.ts";
import { type RouterNavigation, startNavigation } from "../router/router.ts";

/** What Turbo's render events carry that the adapter reads or replaces. */
interface RenderDetail {
  render: (current: Element, next: Element) => unknown;
  resume: () => void;
}

/** The visit under way, until Turbo renders it. */
let current: RouterNavigation | null = null;

/** The link Turbo said was clicked, for the visit that follows it. */
let clicked: { url: string; link: HTMLAnchorElement } | null = null;

function cancel(turn: RouterNavigation): void {
  if (current !== turn) return;
  current = null;
  turn.cancelled();
}

if (inBrowser) {
  addEventListener("turbo:click", (event) => {
    const { target } = event;
    const { url } = (event as CustomEvent<{ url: string }>).detail;
    clicked =
      target instanceof HTMLAnchorElement ? { url, link: target } : null;
  });

  // Before Turbo pushes the history entry: the page left is still the address.
  addEventListener("turbo:before-visit", (event) => {
    const { url } = (event as CustomEvent<{ url: string }>).detail;
    const link = clicked?.url === url ? clicked.link : null;
    clicked = null;
    const turn = startNavigation({
      to: url,
      via: link ? "link" : "script",
      link,
    });
    current = turn;
    // A listener after this one may cancel the visit.
    setTimeout(() => {
      if (event.defaultPrevented) cancel(turn);
    });
  });

  // Back and Forward come with no before-visit.
  addEventListener("turbo:visit", (event) => {
    const { url, action } = (
      event as CustomEvent<{ url: string; action: string }>
    ).detail;
    if (action === "restore") {
      current = startNavigation({ to: url, via: "history" });
    }
  });

  addEventListener("turbo:before-render", (event) => {
    const turn = current;
    if (!turn) return;
    const detail = (event as CustomEvent<RenderDetail>).detail;
    // A preview from Turbo's cache, before the page's real render: the page left stays,
    // leaving, until that comes, or the arrival would play twice.
    if (document.documentElement.hasAttribute("data-turbo-preview")) {
      detail.render = () => {};
      return;
    }
    current = null;
    const { render } = detail;
    // The marks change in the same task as the new body goes in.
    detail.render = async (now, next) => {
      await render(now, next);
      turn.swapped();
    };
    event.preventDefault();
    turn.left.then(() => detail.resume());
  });

  addEventListener("turbo:fetch-request-error", () => {
    if (current) cancel(current);
  });
}
