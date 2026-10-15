// The fixture's one module, bundled by build.mjs: Turbo, pageturn's adapter, and the moves.
import "@hotwired/turbo";
import { defineMove, whenLeft } from "pageturn/core";
import "pageturn/turbo";

defineMove("tint", {
  match: ({ link }) => link.id === "tint",
  leave: () => ({ data: { tone: "teal" } }),
  arrive: (arrival) => note("tint arrive", arrival),
});
defineMove("card", {
  match: ({ link }) => link.id === "card",
  leave: () => ({ returnAs: "card-back", remember: { y: 1 } }),
});
defineMove("card-back", {
  arrive: (arrival) => note("card-back arrive", arrival),
});
whenLeft(() => ({ shown: true }));

// For the tests: the next visit is cancelled by a listener after the adapter's.
addEventListener("turbo:before-visit", (event) => {
  if (window.cancelNext) {
    window.cancelNext = false;
    event.preventDefault();
  }
});
window.turboReady = true;
