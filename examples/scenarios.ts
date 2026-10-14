/**
 * What each example shows, step by step: read by its spec (tests/examples), which checks
 * that each step plays the move it should, and by scripts/record.mjs, which films it for
 * the README.
 *
 * A step is a click on a selector, or the browser's Back, and the move the page reached
 * arrives under.
 */
export interface Step {
  /** What is clicked; without it, the browser's Back. */
  click?: string;
  back?: true;
  /** The move the page reached arrives under; null: none. */
  arrives: string | null;
  /** A morph's layer is on the screen on the way. */
  morph?: true;
  /** The colour the data example hands over, as --turn-tint. */
  tint?: string;
}

export interface Scenario {
  name: string;
  start: string;
  steps: Step[];
}

export const scenarios: Scenario[] = [
  {
    name: "default",
    start: "/examples/default/",
    steps: [
      { click: "main .button", arrives: "page" },
      { click: "main .button", arrives: "page" },
    ],
  },
  {
    name: "named",
    start: "/examples/named/",
    steps: [
      { click: ".work a[href$='atlas.html']", arrives: "project" },
      { click: ".back", arrives: "page" },
      { click: ".work a[data-turn='none']", arrives: null },
    ],
  },
  {
    name: "data",
    start: "/examples/data/",
    steps: [
      { click: ".swatches a:nth-child(3)", arrives: "tint", tint: "#f76707" },
      { click: ".back", arrives: "page" },
      { click: ".swatches a:nth-child(2)", arrives: "tint", tint: "#0c8599" },
    ],
  },
  {
    name: "morph",
    start: "/examples/morph/",
    steps: [
      { click: ".card[href$='lamp.html']", arrives: "product", morph: true },
      { back: true, arrives: "product-back", morph: true },
      { click: ".card[href$='vase.html']", arrives: "product", morph: true },
      { back: true, arrives: "product-back", morph: true },
    ],
  },
  {
    name: "text",
    start: "/examples/text/",
    steps: [
      { click: ".cta .button", arrives: "contact", morph: true },
      { back: true, arrives: "contact-back", morph: true },
    ],
  },
];

/**
 * Notes, on every page, each move it arrives under and each layer a morph puts on
 * the screen. Added before any script of the page runs.
 */
export const WATCH = `(() => {
  if (window.top !== window) return;
  const note = (entry) => {
    const notes = JSON.parse(sessionStorage.getItem("example-notes") || "[]");
    notes.push({ page: location.pathname, ...entry });
    sessionStorage.setItem("example-notes", JSON.stringify(notes));
  };
  const seen = () => {
    const root = document.documentElement;
    if (!root) return;
    const move = root.dataset.turnArriving;
    if (move && move !== seen.move) {
      const style = getComputedStyle(root);
      note({ arrives: move, tint: style.getPropertyValue("--turn-tint").trim() });
    }
    seen.move = move;
    if (document.querySelector("[data-turn-layer]") && !seen.layer) note({ layer: true });
    seen.layer = Boolean(document.querySelector("[data-turn-layer]"));
  };
  // Chromium runs this before <html> exists: the document is watched.
  new MutationObserver(seen).observe(document, { attributes: true, childList: true, subtree: true });
  seen();
  // The default move, played by the browser itself (pageturn.css, in Chromium): named
  // by the transition's type, which pageturn's own listener adds.
  addEventListener("pagereveal", (event) => {
    const transition = event.viewTransition;
    if (transition) setTimeout(() => {
      for (const type of transition.types) note({ arrives: type, native: true });
    });
  });
})();`;
