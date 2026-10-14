/**
 * What the head script, the kernel and the morph each ask of the page, said once.
 */

/** The navigation that loaded this page, as the browser timed it. */
export const navigationEntry = (): PerformanceNavigationTiming | undefined =>
  performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;

/**
 * At DOMContentLoaded, which comes after every module and deferred script, or now if it
 * has been fired. Modules run with the document already "interactive": only the
 * navigation's timing says whether the event has been fired yet.
 */
export function afterDomContentLoaded(run: () => void): void {
  const entry = navigationEntry();
  const hasFired = entry
    ? entry.domContentLoadedEventStart > 0
    : document.readyState !== "loading";
  if (hasFired) run();
  else document.addEventListener("DOMContentLoaded", run, { once: true });
}

/**
 * One query, made at the first use and read at each: the visitor may change the setting
 * while the page is open. Made late, so that a bundle that never asks does not carry it.
 */
let reduced: MediaQueryList | undefined;

export function reducesMotion(): boolean {
  reduced ??= matchMedia("(prefers-reduced-motion: reduce)");
  return reduced.matches;
}

/**
 * The page was not shown anew after all: loaded already scrolled, or put back by a way
 * back. The mark goes, and the kernel is told that this is not an end of the arrival.
 */
export function notShownAnew(): void {
  if (window.pageturn) window.pageturn.notAnew = true;
  delete document.documentElement.dataset.turnEntering;
}

/**
 * The link the package is giving the focus back to, for the moment of the call: its
 * `focusin` is not the visitor going to it. On the global object, under a shared key:
 * the head script's morph half and pageturn/morph each carry their own copy of this.
 */
const FOCUS_BACK = /* @__PURE__ */ Symbol.for("pageturn.focusBack");
const shared = globalThis as typeof globalThis & { [FOCUS_BACK]?: Element };

export function giveFocusTo(element: HTMLElement, options: FocusOptions): void {
  shared[FOCUS_BACK] = element;
  try {
    element.focus(options);
  } finally {
    delete shared[FOCUS_BACK];
  }
}

export const isFocusGivenBack = (element: Element): boolean =>
  shared[FOCUS_BACK] === element;
